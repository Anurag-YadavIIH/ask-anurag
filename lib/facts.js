// Everything the chatbot is allowed to say about Anurag.
// The bot treats this as the ONLY source of truth, so keep every line accurate.
// Edit freely: add facts, fix wording, remove anything you don't want shared.

export const FACTS = `
# Anurag Yadav

## Identity and contact
- Name: Anurag Yadav
- Email: ritesh.anurag325@gmail.com
- LinkedIn: https://www.linkedin.com/in/anuragyadav-fem-bioengineering/
- GitHub: https://github.com/Anurag-YadavIIH
- Resume (PDF): https://drive.google.com/file/d/1IZLPwaw_fSG4Yq2RCNmYov0nQsAbKwTM/view?usp=sharing

## What I'm looking for
- Roles: AI/ML engineer, medical imaging AI, computer vision, and data roles, especially in healthcare and medtech.
- Open to relocation and remote work.

## Education
- M.Tech in Ophthalmic Engineering, IIT Hyderabad, 2023 to 2025. CGPA 9.18.
- Admitted to IIT Hyderabad through GATE 2023 (Environmental Science paper), score 450.
- M.Tech thesis: finite element modelling of penetrating keratoplasty (full thickness corneal transplant) in Abaqus and Python, studying how suture tension affects corneal biomechanics. Advised by Dr. Viswanath Chinthapenta.
- B.Tech in Civil Engineering, Bangalore Institute of Technology, graduated 2021.

## Experience
- Associate Consultant Intern, Orbees Medical, August 2025 to October 2025. My first and only industry role so far, in the medical domain.
- Since then: building medical imaging AI and GenAI projects full time.
- I have not worked at any other company.

## Projects
### OcuVal: retinal fluid segmentation in OCT (current, in progress)
- Segments three retinal fluid types in OCT scans: intraretinal fluid, subretinal fluid and pigment epithelial detachment.
- Reads DICOM directly. Uses the RETOUCH challenge dataset, which has scans from Cirrus, Spectralis and Topcon devices. Registered RETOUCH challenge team name: OcuVal.
- Focus on cross-vendor validation, because a model that only works on one scanner is not usable in a clinic.
- Documentation modelled on IEC 62304, the medical device software standard.
- Training on Kaggle GPUs. Results are still in progress, so there are no final metrics yet.
- Repo: https://github.com/Anurag-YadavIIH/retinal-oct-fluid-segmentation

### RetinaPrep: retinal fundus dataset audit
- Curates retinal fundus image datasets and audits them for data leakage (for example the same patient or duplicate images in both train and test sets).
- Publishes audit reports on GitHub Pages. Being extended with segmentation, a second dataset and a cross-camera audit.
- Repo: https://github.com/Anurag-YadavIIH/retinal-dataset-audit
- Reports: https://anurag-yadaviih.github.io/retinal-dataset-audit

### ConsultRAG: security-first RAG assistant for consulting teams
- Redacts personal and health data (PII/PHI) locally before indexing.
- Role-based access control with each client engagement isolated.
- Hybrid dense plus BM25 retrieval fused with reciprocal rank fusion (RRF), optional cross-encoder reranking, grounded answers with citations.
- Ingests .pptx slides and speaker notes, PDF, text and markdown, and meeting audio with timestamps.
- Stack: Python, FastAPI, Postgres with pgvector, sentence-transformers, Ollama local LLM, Streamlit demo, Next.js with TypeScript and Tailwind, Docker Compose, pytest, Langfuse tracing, Google OIDC login.
- Retrieval evaluated with hit@k, recall@k and MRR against a gold question set.

### Diabetic retinopathy detection
- Classifies diabetic retinopathy from fundus photos with a fine-tuned ResNet18, served through a Flask web app.
- Repo: https://github.com/Anurag-YadavIIH/retina-ai-detection

### Other projects
- Medical research agent: LLM agent using LangChain, embeddings, RAG, Pinecone and OpenAI APIs.
- Agentic job application copilot: multi-agent workflow with LangGraph, FastAPI and React/TypeScript.
- AI resume tailoring app: LLM tool that produces ATS-friendly resumes tailored to different roles.
- Healthcare predictive analytics: machine learning on healthcare data.
- Wildfire prediction: ML models with data pipelines and evaluation.
- Recommendation engine: six recommender models compared on MovieLens, with a Streamlit app.
- Pizza sales analytics: data analysis and visualisation project.
- Draftly: Gmail AI reply agent written in Java (course capstone).
- This chatbot ("AI Anurag"): Node.js serverless function on Vercel calling an open model on Groq, with per-visitor limits, a daily budget cap and a guardrail prompt.

## Skills
- Languages: Python (main), SQL, JavaScript/TypeScript, Java, C++.
- ML and imaging: deep learning for segmentation and classification, transfer learning, TensorFlow, scikit-learn, image processing, DICOM.
- GenAI: RAG pipelines, hybrid retrieval, LangChain, LangGraph, Pinecone, pgvector, OpenAI APIs, Ollama, Langfuse.
- Backend and tools: FastAPI, Flask, Django, PostgreSQL, MySQL, Docker, Git, Streamlit, Next.js, React.
- Data and BI: Excel, Power BI, Tableau.
- Engineering and domain: ocular anatomy and imaging, finite element analysis in Abaqus, biomechanics.

## Things to hand over to the real Anurag
- Salary expectations, notice period and joining date, interview scheduling, references, and anything personal: say Anurag will discuss these directly and give his email.
`;
