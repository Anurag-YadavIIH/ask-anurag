// All copy on the site lives here. Edit text in this file, then run `npm run build`.
// Rules: no em dashes, and no metric, result or claim that isn't true. Anything not
// measured or written yet is null with a TODO(anurag) comment: production builds
// leave it out, dev and preview builds show a dashed placeholder.
// tests/content-drift.test.js checks the facts shared with lib/facts.js (the chatbot).

import type { Site } from "./types.ts";

const GH = "https://github.com/Anurag-YadavIIH";

const person = {
  name: "Anurag Yadav",
  email: "ritesh.anurag325@gmail.com",
  jobTitle: "AI/ML engineer, medical imaging",
  linkedin: "https://www.linkedin.com/in/anurag-yadav-ai",
  github: GH,
};

const education = {
  masters: { degree: "M.Tech in Ophthalmic Engineering", school: "IIT Hyderabad", years: "2023 to 2025", cgpa: "9.18" },
  bachelors: { degree: "B.Tech in Civil Engineering", school: "Bangalore Institute of Technology", years: "2021" },
};

const internship = {
  role: "Associate Consultant Intern",
  org: "Orbees Medical",
  start: "August 2025",
  end: "October 2025",
  summary:
    "Healthcare consulting: US market research on medtech and medical device companies, a competitive strategy wargame, and Excel dashboards for market intelligence.",
};

const availability = { status: "Available now", location: "India", workModes: "Remote or relocation" };

export const site: Site = {
  url: "https://ask-anurag.vercel.app",
  person,
  resume: {
    file: "resume.pdf",
    downloadName: "Anurag_Yadav_Resume.pdf",
    fallbackUrl: "https://drive.google.com/file/d/1IZLPwaw_fSG4Yq2RCNmYov0nQsAbKwTM/view?usp=sharing",
  },
  availability,
  education,
  internship,

  meta: {
    title: "Anurag Yadav | AI for medical imaging",
    description:
      "Anurag Yadav, M.Tech Ophthalmic Engineering (IIT Hyderabad). Builds retinal imaging pipelines, tests whether OCT segmentation holds up across scanners, and builds secure RAG systems in Python.",
    ogAlt: "Anurag Yadav: AI for medical images, built by someone who studied the eye.",
  },

  nav: [
    { label: "Work", href: "/#work" },
    { label: "Demos", href: "/#demos" },
    { label: "About", href: "/#about" },
    { label: "Contact", href: "/#contact" },
  ],

  hero: {
    h1: "AI for medical images, built by someone who studied the eye.",
    subline:
      "I build retinal imaging pipelines and test whether segmentation models hold up across scanners, plus secure RAG systems in Python. M.Tech in Ophthalmic Engineering, IIT Hyderabad.",
    primaryCta: { label: "See my work", href: "#work" },
    secondaryCta: "Email me",
    askAi: "Ask AI Anurag",
    scanCaption:
      "Drag across the scan to reveal the segmentation, switch scanners to see why a model trained on one device can fail on another, and toggle a fluid type to hide it. This is the problem OcuVal works on.",
  },

  credentials: [
    { title: "IIT Hyderabad", detail: `M.Tech, CGPA ${education.masters.cgpa}` },
    { title: "RETOUCH challenge", detail: "Registered team, OcuVal" },
    { title: "3 OCT vendors", detail: "Cirrus, Spectralis, Topcon" },
    { title: "IEC 62304 style", detail: "Medical software documentation" },
  ],

  work: {
    heading: "Three projects, one habit: trust the data before the model.",
    intro: "",
    featured: [
      {
        slug: "ocuval",
        name: "OcuVal",
        tag: "Current project, in progress",
        title: "OcuVal: retinal fluid segmentation in OCT",
        summary:
          "Segments intraretinal fluid, subretinal fluid and pigment epithelial detachment in OCT scans, reads DICOM directly, and tests whether the model holds up across scanners from different manufacturers.",
        tech: ["Python", "Deep learning", "Segmentation", "DICOM", "RETOUCH dataset"],
        repo: { label: "Code on GitHub", href: `${GH}/retinal-oct-fluid-segmentation` },
        extraLinks: [],
        metrics: [
          // TODO(anurag): OcuVal mean Dice across IRF, SRF and PED, once results are final.
          { label: "Mean Dice, all fluid types", value: null, placeholder: "[0.00]" },
          // TODO(anurag): OcuVal Dice on a scanner vendor held out from training.
          { label: "Dice on an unseen vendor", value: null, placeholder: "[0.00]" },
          { label: "Scanner vendors in the data", value: "3", placeholder: "3", inline: "Data from 3 scanner vendors: Cirrus, Spectralis, Topcon" },
          // TODO(anurag): number of OCT volumes in the OcuVal training set.
          { label: "OCT volumes in training", value: null, placeholder: "[N]" },
        ],
        caseStudy: {
          problem: [
            "Scanners from different manufacturers produce OCT images that look different, so a segmentation model trained on one device can fail on another.",
            "A model that only works on one scanner is not usable in a clinic, so OcuVal treats cross-vendor validation as part of the job.",
          ],
          data: [
            "The RETOUCH challenge dataset, with OCT scans from Cirrus, Spectralis and Topcon devices. I am registered for the challenge as team OcuVal.",
            "Scans are read directly from DICOM.",
          ],
          approach: [
            "Segments three retinal fluid types: intraretinal fluid (IRF), subretinal fluid (SRF) and pigment epithelial detachment (PED).",
            "The focus is cross-vendor validation: testing whether the model holds up on scans from each manufacturer.",
            "Documentation is modelled on IEC 62304, the standard for medical device software.",
            "Training runs on Kaggle GPUs.",
          ],
          results: {
            intro: [
              "Results are still in progress, so there are no final metrics yet.",
              "The evaluation had a defect, found on 16 October 2026, and results will be posted once it is corrected.",
            ],
            metrics: [
              // TODO(anurag): same numbers as the OcuVal card above.
              { label: "Mean Dice, all fluid types", value: null, placeholder: "[0.00]" },
              { label: "Dice on an unseen vendor", value: null, placeholder: "[0.00]" },
              { label: "OCT volumes in training", value: null, placeholder: "[N]" },
            ],
          },
          // TODO(anurag): OcuVal "What I'd do next" (two or three sentences).
          next: null,
        },
      },
      {
        slug: "retinaprep",
        name: "RetinaPrep",
        tag: "Data quality",
        title: "RetinaPrep: fundus dataset audit",
        summary:
          "Curates retinal fundus image datasets and audits them for data leakage, the quiet problem that makes medical AI models look better than they are.",
        tech: ["Python", "Image processing", "Data quality", "GitHub Pages"],
        repo: { label: "Code on GitHub", href: `${GH}/retinal-dataset-audit` },
        extraLinks: [{ label: "Audit reports", href: "https://anurag-yadaviih.github.io/retinal-dataset-audit" }],
        metrics: [
          // TODO(anurag): share of patients RetinaPrep found on both sides of a public train/test split.
          { label: "of patients found on both sides of a public split", value: null, placeholder: "[X%]" },
        ],
        caseStudy: {
          problem: [
            "If images of the same patient end up in both the training and test sets, a model can learn to recognise the patient's eye instead of the disease. The test score then looks better than it really is.",
          ],
          // TODO(anurag): RetinaPrep data: which fundus datasets it audits.
          data: null,
          approach: [
            "Curates the dataset, then checks it for leakage, such as the same patient or duplicate images appearing in both the train and test sets.",
            "Publishes readable audit reports on GitHub Pages.",
          ],
          results: {
            // TODO(anurag): RetinaPrep results summary in one or two sentences.
            intro: null,
            metrics: [{ label: "of patients found on both sides of a public split", value: null, placeholder: "[X%]" }],
          },
          next: ["Extending RetinaPrep with segmentation, a second dataset and a cross-camera audit."],
        },
      },
      {
        slug: "consultrag",
        name: "ConsultRAG",
        tag: "GenAI, security-first",
        title: "ConsultRAG: secure RAG for consulting teams",
        summary:
          "Answers questions across slide decks, PDFs and meeting recordings with citations, while client data stays private and separated by engagement.",
        tech: ["RAG", "FastAPI", "PostgreSQL", "pgvector", "Ollama", "Next.js", "Docker"],
        repo: { label: "Code on GitHub", href: `${GH}/consulting-rag-assistant` },
        extraLinks: [],
        metrics: [
          // TODO(anurag): ConsultRAG recall@5 on the gold question set, hybrid vs dense.
          { label: "recall@5 on a gold question set, hybrid vs dense", value: null, placeholder: "[0.00]" },
        ],
        caseStudy: {
          problem: [
            "Consulting teams want answers from their own slide decks, documents and meeting recordings, with client data kept private and each engagement kept separate.",
          ],
          data: ["Ingests .pptx slides and speaker notes, PDF, text and markdown, and meeting audio with timestamps."],
          approach: [
            "Redacts personal and health data (PII and PHI) locally before anything is indexed.",
            "Role-based access control, with each client engagement isolated.",
            "Hybrid dense and BM25 retrieval fused with reciprocal rank fusion, optional cross-encoder reranking, and grounded answers with citations.",
            "Stack: Python, FastAPI, Postgres with pgvector, sentence-transformers, Ollama, Next.js, Docker Compose, pytest and Langfuse tracing.",
          ],
          results: {
            intro: ["Retrieval is evaluated with hit@k, recall@k and MRR against a gold question set."],
            metrics: [{ label: "recall@5 on a gold question set, hybrid vs dense", value: null, placeholder: "[0.00]" }],
          },
          // TODO(anurag): ConsultRAG "What I'd do next" (two or three sentences).
          next: null,
        },
      },
    ],
  },

  demos: {
    heading: "Try the ideas behind the work",
    intro: "Two small demos that run entirely in your browser.",
    leak: {
      title: "Spot the data leak",
      blurb: "Split 40 eye images from 10 patients into train and test, and see how many patients end up on both sides. This is the check RetinaPrep automates.",
    },
    search: {
      title: "Search my portfolio with BM25",
      blurb: "A tiny retrieval engine, the same idea behind my RAG work. It ranks passages about me and shows the evidence it used.",
    },
  },

  more: {
    heading: "More projects",
    projects: [
      {
        title: "Diabetic retinopathy detection",
        line: "Classifies diabetic retinopathy from fundus photos with a fine-tuned ResNet18, served through a Flask web app.",
        stack: "Python, ResNet18, transfer learning, Flask",
        repo: `${GH}/retina-ai-detection`,
      },
      {
        title: "M.Tech thesis: corneal biomechanics",
        line: "Finite element model of how suture tension changes the cornea after a full thickness corneal transplant.",
        stack: "Abaqus, Python, finite element analysis",
        repo: `${GH}/PK-FEM-Corneal-Biomechanics`,
      },
      {
        title: "Agentic job application copilot",
        line: "A multi-agent workflow that helps with job applications, from reading a job post to tailoring the application.",
        stack: "LangGraph, FastAPI, React, TypeScript",
        repo: `${GH}/agentic-job-copilot`,
      },
      {
        title: "Recommendation engine",
        line: "Six recommender models compared on MovieLens, with a Streamlit app to explore the results.",
        stack: "Python, Streamlit, recommender systems",
        repo: `${GH}/ecommerce-recommendation-engine`,
      },
    ],
    allLink: { label: "All projects on GitHub", href: `${GH}?tab=repositories` },
  },

  about: {
    heading: "From concrete to corneas to code",
    paragraphs: [
      "I started as a civil engineer. Structural thinking led me to biomechanics, and an M.Tech at IIT Hyderabad took me into ophthalmic engineering, where my thesis simulated how suture tension changes the cornea after a transplant.",
      "That work showed me how much of eye care runs on images. Now I build AI for retinal imaging, auditing datasets so models can be trusted and testing whether OCT segmentation holds up across devices, plus applied GenAI systems with the same habits: careful data handling, honest evaluation and clear documentation.",
    ],
    timeline: [
      {
        when: "2026, now",
        title: "Building medical imaging AI",
        body: "OcuVal for OCT fluid segmentation as a registered RETOUCH challenge team, and RetinaPrep for fundus dataset auditing.",
        now: true,
      },
      {
        when: "Aug to Oct 2025",
        title: `${internship.role}, ${internship.org}`,
        body: internship.summary,
      },
      {
        when: education.masters.years,
        title: `${education.masters.degree}, ${education.masters.school}`,
        body: `CGPA ${education.masters.cgpa}. Thesis on finite element modelling of a corneal transplant in Abaqus and Python, studying how suture tension affects corneal biomechanics.`,
      },
      {
        when: education.bachelors.years,
        title: `${education.bachelors.degree}, ${education.bachelors.school}`,
        body: "Foundations in mechanics, surveying and environmental engineering, which later fed straight into biomechanics.",
      },
    ],
  },

  stack: {
    heading: "Stack",
    groups: [
      {
        name: "Imaging and ML",
        items: ["Python", "deep learning for segmentation and classification", "transfer learning", "TensorFlow", "scikit-learn", "image processing", "DICOM"],
      },
      {
        name: "GenAI",
        items: ["RAG", "hybrid retrieval", "LangChain", "LangGraph", "pgvector", "Pinecone", "OpenAI APIs", "Ollama", "Langfuse"],
      },
      {
        name: "Engineering",
        items: ["FastAPI", "Flask", "Django", "PostgreSQL", "MySQL", "SQL", "Docker", "Git", "Streamlit", "Next.js", "React", "TypeScript"],
      },
      {
        name: "Domain",
        items: ["ocular anatomy and imaging", "OCT and fundus imaging", "finite element analysis in Abaqus", "biomechanics", "IEC 62304 style documentation", "healthcare market research"],
      },
    ],
  },

  contact: {
    heading: "Building an imaging or AI team?",
    intro: "I'm looking for AI/ML engineer and medical imaging roles. Email is the quickest way to reach me.",
    copyLabel: "Copy email",
    copiedLabel: "Copied",
  },

  footer: { note: "OCT image and demos are synthetic and generated in your browser. No patient data." },

  searchDocs: [
    { t: "Medical imaging experience", x: "Yes. My main focus is AI for retinal imaging. OcuVal segments retinal fluid in OCT scans and tests the model on data from three scanner vendors, RetinaPrep audits fundus image datasets for leakage, and I built a diabetic retinopathy classifier with ResNet18." },
    { t: "OcuVal", x: "OcuVal is my current project: DICOM-native segmentation of intraretinal fluid, subretinal fluid and pigment epithelial detachment in OCT scans, trained on the RETOUCH challenge dataset with cross-vendor validation across Cirrus, Spectralis and Topcon, and IEC 62304 style documentation." },
    { t: "RetinaPrep and data leakage", x: "RetinaPrep curates retinal fundus datasets and audits them for data leakage, such as the same patient or duplicate images appearing in both train and test sets. It publishes audit reports on GitHub Pages." },
    { t: "ConsultRAG", x: "ConsultRAG is a security-first RAG assistant for consulting teams. It redacts PII and PHI before indexing, isolates each client engagement with role-based access, uses hybrid dense plus BM25 retrieval fused with RRF and an optional cross-encoder reranker, and gives cited answers. Built with FastAPI, pgvector, Ollama, Next.js and Docker, evaluated with hit@k, recall@k and MRR." },
    { t: "GenAI and LLM agents", x: "I build LLM applications and agents: a medical research agent with LangChain, Pinecone and OpenAI, a multi-agent job copilot with LangGraph, an AI resume tailoring app, and Draftly, a Gmail reply agent in Java." },
    { t: "Education", x: `${education.masters.degree} from ${education.masters.school} with CGPA ${education.masters.cgpa}, admitted through GATE 2023 Environmental Science with a score of 450. ${education.bachelors.degree} from ${education.bachelors.school}, ${education.bachelors.years}.` },
    { t: "M.Tech thesis", x: "My thesis used finite element modelling in Abaqus and Python to study how suture tension affects corneal biomechanics after penetrating keratoplasty, a full thickness corneal transplant. It gave me a deep understanding of eye anatomy." },
    { t: "Work experience", x: `I worked as an ${internship.role.toLowerCase()} at ${internship.org} from August to October 2025, doing healthcare market research: medtech and medical device competitors, US healthcare trends, ambulatory care models, a strategy wargame project, Excel dashboards and client-facing reports. Since then I have been building medical imaging AI projects.` },
    { t: "Programming skills", x: "Python is my main language. I also use SQL, JavaScript, TypeScript, Java and C++. For machine learning I use TensorFlow for deep learning segmentation and classification, and scikit-learn for classical ML. For backends I use FastAPI, Flask and Django, with PostgreSQL, MySQL and Docker." },
    { t: "Data analytics", x: "I do data analysis and visualisation with SQL, Excel, Power BI and Tableau, for example a pizza sales analytics dashboard, plus healthcare predictive analytics and wildfire prediction models." },
    { t: "Availability and roles", x: `I am open to AI/ML engineer, medical imaging AI, computer vision and data roles, especially in healthcare and medtech. I am available to join immediately, based in ${availability.location}, and open to remote work or relocation.` },
    { t: "Why hire me", x: "I combine domain knowledge of the eye from an ophthalmic engineering M.Tech with hands-on AI engineering. I care about data quality, honest evaluation and documentation, which matter most in medical AI." },
    { t: "Contact", x: `The best way to reach me is email at ${person.email}. You can also find me on LinkedIn and on GitHub as Anurag-YadavIIH.` },
  ],
};
