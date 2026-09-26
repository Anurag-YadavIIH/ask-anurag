// Question limits, enforced on the server so visitors can't bypass them.
//   Per visitor: PER_VISITOR_DAILY questions per IP per day (default 5)
//   Everyone:    GLOBAL_DAILY questions per day in total (default 300), a budget safety net
//
// Storage: Upstash Redis (free tier) when UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN are set. Otherwise an in-memory counter, which is
// fine for local testing but resets whenever Vercel starts a new instance.

import crypto from "node:crypto";

const memory = new Map();

export function dayKey(now = new Date()) {
  return now.toISOString().slice(0, 10); // UTC date, e.g. 2026-09-26
}

// Store a hash of the IP, not the IP itself.
export function visitorId(ip, salt = process.env.IP_SALT || "ask-anurag") {
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 24);
}

async function upstash(commands, env) {
  const res = await fetch(`${env.UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  return (await res.json()).map((r) => r.result);
}

function memIncr(key) {
  const v = (memory.get(key) || 0) + 1;
  memory.set(key, v);
  return v;
}

export function createLimiter({ env = process.env, now = () => new Date() } = {}) {
  const perVisitor = Number(env.PER_VISITOR_DAILY || 5);
  const globalCap = Number(env.GLOBAL_DAILY || 300);
  const useRedis = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);

  // Counts this question and reports whether it's allowed.
  async function consume(ip) {
    const day = dayKey(now());
    const vKey = `aa:v:${day}:${visitorId(ip)}`;
    const gKey = `aa:g:${day}`;
    let v, g;
    if (useRedis) {
      [v, , g] = await upstash(
        [["INCR", vKey], ["EXPIRE", vKey, 172800], ["INCR", gKey], ["EXPIRE", gKey, 172800]],
        env
      );
    } else {
      v = memIncr(vKey);
      g = memIncr(gKey);
    }
    if (v > perVisitor) {
      // A visitor over their limit must not use up everyone else's daily budget.
      if (useRedis) await upstash([["DECR", gKey]], env);
      else memory.set(gKey, g - 1);
      return { allowed: false, reason: "visitor", remaining: 0 };
    }
    if (g > globalCap) {
      if (useRedis) await upstash([["DECR", vKey]], env);
      else memory.set(vKey, v - 1);
      return { allowed: false, reason: "global", remaining: perVisitor - v + 1 };
    }
    return { allowed: true, remaining: perVisitor - v };
  }

  // Gives the question back when the model call fails, so visitors aren't charged for errors.
  async function refund(ip) {
    const day = dayKey(now());
    const vKey = `aa:v:${day}:${visitorId(ip)}`;
    const gKey = `aa:g:${day}`;
    if (useRedis) await upstash([["DECR", vKey], ["DECR", gKey]], env);
    else {
      memory.set(vKey, Math.max(0, (memory.get(vKey) || 1) - 1));
      memory.set(gKey, Math.max(0, (memory.get(gKey) || 1) - 1));
    }
  }

  return { consume, refund, perVisitor, globalCap, storage: useRedis ? "upstash" : "memory" };
}

export function _resetMemory() {
  memory.clear();
}
