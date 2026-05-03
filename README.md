# Gladstone Activity Recommender System

A personalised class recommendation engine for the Gladstone leisure-management platform. The system learns each member's booking history and produces a ranked shortlist of up to five activity recommendations, filtered for site availability, age appropriateness, and variety.

> **Handoff note for developers:** You do not need to understand how the model works to run this project. Follow the [Quick Start](#quick-start) section and the app will be running in under five minutes. Everything else in this README is background context.

---

## What This Project Does

Members of Gladstone-managed leisure centres tend to repeatedly book the same small set of popular classes, while most of the timetable goes undiscovered. This system changes that by learning each member's preferences from their booking history and surfacing activities they are likely to enjoy but have not yet tried.

The system was developed through three iterations:

| Version | What it does |
|---|---|
| **V3** | Baseline - recommends using collaborative filtering and a gradient-boosted ranking model across 37 broad activity groups |
| **V4** | Operational fix - adds site availability checks, age filters, and expanded the activity catalogue to 416 specific activities |
| **V5** | Production model - replaces the ranking engine with SASRec, a deep learning model that reads each member's booking sequence and predicts what they will book next |

**V5 is the production model.** V3 and V4 are retained in `archive/` for reference.

---

## App Screenshots

**Home Dashboard**

![Home Dashboard](docs/assets/Home%20Page.png)

The home page shows the V5 production model headline metrics (NDCG@5, P@5, MAP@5, Coverage, Diversity) and a summary of system status. Known caveats and data limitations are surfaced here so operators are aware before browsing member recommendations.

---

**Member Lookup and Recommendations**

![Member Recommendations](docs/assets/RecSysDemo.png)

The Clients page allows lookup by ContactID. Each member shows demographics, cluster assignment, and three recommendation slates side by side: V5 Filtered (production slate after site and age filtering), V5 New (novel activities the member has not booked before), and V5 Rebook (familiar activities from their history). Scores are SASRec softmax outputs.

---

## Repository Layout

```
gladstone-recsys/
│
├── app/                    ← FastAPI web application (demo frontend)
│   ├── app/                ← Python package (routes, templates, auth)
│   ├── LMreport/           ← Analytics charts and HTML reports
│   ├── Dockerfile
│   └── run.sh
│
├── model/                  ← V5 SASRec model (production)
│   ├── sasrec_model.py     ← Model architecture
│   ├── train.py            ← Training script
│   ├── data_prep.py        ← Prepares sequences and vocab from parquets
│   ├── serve_v5_recommendations.py  ← Generates recommendation slates
│   ├── filter_v5.py        ← Applies business rules (site, age, diversity)
│   ├── checkpoints/        ← Trained model weights (trial_000-039.pt)
│   ├── clustering/         ← User clustering scripts
│   ├── cold_start/         ← Fallback for new members with no history
│   └── outputs/            ← Pre-computed recommendation files
│
├── data/
│   ├── processed/
│   │   ├── cleaned_data_24m/   ← Final cleaned interaction parquets
│   │   └── v5/
│   │       ├── dataset/        ← Vocab files + training sequences
│   │       ├── clustering/     ← Cluster assignments and profiles
│   │       └── cold_start/     ← Lookup tables for new members
│   └── sql/                    ← Original schema reference
│
├── notebooks/24m/          ← Experiment notebooks (01-10, read-only reference)
├── reports/final_submission/  ← Submitted report + all figures
├── archive/                ← V3, V4 code and outputs (reference only)
├── configs/base.yaml       ← Model and pipeline configuration
├── docs/                   ← Technical documentation
├── scripts/
│   ├── macos/              ← macOS startup scripts
│   └── win/                ← Windows startup scripts
├── pyproject.toml          ← Project dependencies (root)
└── docker-compose.yml      ← Start the app with one command
```

---

## Quick Start

### Option A - Docker (recommended, works on all platforms)

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

```bash
# 1. Clone the repository
git clone <repo-url>
cd mmai-gladstone-recsys-dev

# 2. Start the app
docker compose up

# 3. Open your browser
# http://127.0.0.1:5000/login
```

To stop: press `Ctrl+C` in the terminal, then run `docker compose down`.

---

### Option B - Run locally without Docker

**Prerequisites:** Python 3.11+, [uv](https://docs.astral.sh/uv/getting-started/installation/) or pip.

```bash
# 1. Clone the repository
git clone <repo-url>
cd mmai-gladstone-recsys-dev

# 2. Start the app using the platform script
bash scripts/macos/start_app.sh     # macOS / Linux
scripts\win\start_app.bat           # Windows

# 3. Open your browser
# http://127.0.0.1:5000/login
```

---

## Demo Login

This is a demo application. Use the following credentials to sign in:

| Field | Value |
|---|---|
| **Username** | `admin` |
| **Password** | `admin` |

The login form is prefilled for convenience — just click **Sign in**.

---

## Platform-Specific Start Scripts

| Platform | Script | What it does |
|---|---|---|
| macOS / Linux | `bash scripts/macos/start_app.sh` | Installs deps, builds DuckDB if needed, starts app |
| Windows | `scripts\win\start_app.bat` | Same flow for Windows |
| macOS / Linux (DB only) | `bash scripts/macos/setup_duckdb.sh` | Builds DuckDB without starting the app |
| Windows (DB only) | `scripts\win\setup_duckdb.bat` | Same for Windows |

All scripts find the repo root automatically — run them from any directory.

---

## What You Will See in the App

| Page | What it shows |
|---|---|
| **Home** | Overview dashboard |
| **Clients** | Member list and search |
| **Profiles** | Individual member recommendation slate and booking history |
| **Activities** | Activity catalogue with booking statistics |
| **Sites** | Per-site activity availability |
| **Cold Start** | Recommendations for new members with no booking history |
| **Calibration** | Model performance metrics |
| **Admin** | System administration |

---

## Pre-Computed Outputs

The app serves from pre-computed files - you do not need to retrain the model to use it.

| File | What it contains |
|---|---|
| `model/outputs/recommendations_v5_filtered.csv` | Production recommendations (site + age + diversity filtered) |
| `model/outputs/recommendations_v5_new.csv` | Novel activity recommendations (items member has not booked) |
| `model/outputs/recommendations_v5_rebook.csv` | Familiar activity recommendations (items member has booked before) |
| `data/processed/v5/cold_start/cold_start_lookup_table.parquet` | Fallback recommendations for new members |
| `data/processed/gladstone.duckdb` | DuckDB database used by the app for fast queries |

---

## Retraining the Model (Advanced)

Only needed if you have new data. The app works out of the box with the pre-computed files above.

```bash
cd model

# Step 1 - Prepare sequences from the cleaned parquets
python data_prep.py

# Step 2 - Run the hyperparameter sweep (optional, takes ~14 hours on Apple Silicon)
python sweep.py

# Step 3 - Train the final model
python train.py

# Step 4 - Generate recommendation slates
python serve_v5_recommendations.py

# Step 5 - Apply business filters
python filter_v5.py
```

The best checkpoint from the original sweep is `model/checkpoints/trial_021.pt`.

---

## Running the Tests

```bash
# From repo root
python -m pytest tests/
```

---

## Key Numbers (for context)

| Metric | Value |
|---|---|
| Members in training data | 96,152 |
| Members in V5 test evaluation | 21,631 |
| Activity groups (V3) | 37 |
| Canonical activities (V4/V5) | 416 |
| Booking interactions | 2,456,112 |
| Data window | March 2024 - March 2026 (24 months) |
| Recommendation accuracy (NDCG@5, V5 production) | 0.567 |
| Members receiving a full top-5 slate | 79.2% |

---

## Glossary (Plain English)

| Term | What it means |
|---|---|
| **SASRec** | The deep learning model at the core of V5. Reads each member's booking history as a sequence to predict their next activity. |
| **Candidate pool** | A shortlist of ~30 activities the model considers before applying filters. |
| **Filter stack** | Business rules applied after scoring: only recommend activities available at the member's site, appropriate for their age, and varied enough to avoid repetition. |
| **Cold start** | The challenge of recommending to new members with no booking history. Handled by a separate lookup table based on age, site, and segment. |
| **NDCG@5** | A standard measure of recommendation accuracy. Higher is better; 1.0 is perfect. V5 production scores 0.567 versus V3's 0.457. |
| **Parquet** | A compressed data file format used to store the interaction and feature data. |
| **DuckDB** | A fast in-process database used by the app to query recommendation data without a separate database server. |

---

## Further Reading

| Resource | Location |
|---|---|
| Technical report | `reports/final_submission/MMAI847-03-FinalProjectReport-Gladstone-Final.docx` |
| Model findings | `model/outputs/findings_v5.md` |
| Data pipeline documentation | `docs/data_pipeline.md` |
| System design | `docs/system_design.md` |
| Analytics source of truth | `app/LMreport/Gladstone_Analytics_Source_of_Truth.md` |
| V5 model documentation | `docs/v5_model.md` |

---

## Contributors

This project was developed as a capstone by a team from the Smith School of Business,
Queen's University, in the MMAI 847 course.

| Name | Role                      |
|---|---------------------------|
| Fengyuexin Huang | Modelling and Evaluation  |
| Divya Chandrashekar | Product Lead              |
| Mohamed [Surname] | Modelling and Evaluation  |
| Sehrish Siddiqui | Product Lead  |
| Han Sun | Data Engineering and Pipeline |
| Deenu Gengiti | Modelling and Evaluation |

Supervised by Professor Alex Scottavs, Smith School of Business, Queen's University.