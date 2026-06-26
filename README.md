# Agentic AI Playwright POC

An end-to-end **Agentic AI framework** that runs interactively during a live demo to:

1. **Prompt the presenter** for one or more Jira issue keys and plain-English test cases
2. **Read each Jira story** via the Atlassian REST API
3. **Generate Playwright TypeScript tests** using Claude (claude-sonnet-4-6) with a fixed scaffold template — one test block per plain-English case, nothing more
4. **Commit & push** the generated tests to the `agent/auto-tests` branch on GitHub
5. **Trigger GitHub Actions** CI/CD which runs the tests against a live mock server backed by SQLite
6. **Poll** until the workflow run completes
7. **Download** the Playwright `results.json` from the agent branch
8. **Open two browser tabs** in a new session: an interactive HTML test results dashboard and an animated login demo UI
9. **Post results back to every Jira ticket** as a rich ADF comment with a test results table, and transition each story to Done on success

---

## How the demo works

Run `npm run agent` and the terminal becomes interactive:

```
🎤  INTERACTIVE DEMO MODE
──────────────────────────────────────────────────────
  Story 1 – Jira issue key (or ENTER to finish): AQA-1

  📝  Adding plain-English test cases for AQA-1
    Test case 1 description: Login should succeed for a US Person
    Endpoint [default: GET /api/login]:
    Expected outcome: Returns success true

    Test case 2 description: Login should be denied for a Non-US Person
    Endpoint [default: GET /api/login]:
    Expected outcome: Returns success false with message "Only US Persons are allowed"

  ✅  Story AQA-1 added with 2 custom test case(s)

  Story 2 – Jira issue key (or ENTER to finish): AQA-2
  ...
  Story 3 – Jira issue key (or ENTER to finish):   ← ENTER to start pipeline
```

The agent then runs the full pipeline unattended and opens both visual reports in your browser when done.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       Your MacBook                           │
│                                                              │
│  npm run agent                                               │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────────────────────────────────────────────────┐     │
│  │           src/agent/index.ts  (Orchestrator)        │     │
│  └──┬──────────────┬─────────────────┬─────────────────┘     │
│     │              │                 │                        │
│  ┌──▼──────┐  ┌────▼──────┐  ┌──────▼──────────────────┐    │
│  │  Jira   │  │  SQLite   │  │  Claude API             │    │
│  │  Client │  │  (users   │  │  (test scaffold +       │    │
│  │  REST   │  │   + /api/ │  │   assertion bodies)     │    │
│  │  API v3 │  │   users)  │  │  claude-sonnet-4-6      │    │
│  └──┬──────┘  └───────────┘  └──────┬──────────────────┘    │
│     │                               │                        │
│  ┌──▼───────────────────────────────▼──────────────────┐     │
│  │              GitHub Client (Octokit)                │     │
│  │  • ensureBranch  • commitFile  • triggerWorkflow    │     │
│  │  • waitForLatestRun  • getContent (results.json)    │     │
│  └──────────────────────────┬───────────────────────────┘    │
│                             │                                 │
│  ┌──────────────────────────▼───────────────────────────┐    │
│  │   Local Reports (auto-opened in new browser session) │    │
│  │   • local-reports/report-<id>.html  (test dashboard) │    │
│  │   • local-reports/login-ui-<id>.html (login demo UI) │    │
│  └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                             │
          ┌──────────────────▼──────────────────────────┐
          │                 GitHub                      │
          │  main branch    — ci.yml, src/, scripts/    │
          │  agent/auto-tests — tests/generated/*.spec  │
          │                    playwright.config.ts     │
          │                    playwright-report/       │
          │                                             │
          │  CI job:                                    │
          │  1. Checkout main (deps + source)           │
          │  2. Overlay tests from agent/auto-tests     │
          │  3. npm ci + Playwright install             │
          │  4. Seed SQLite + start mock server         │
          │  5. npx playwright test                     │
          │  6. Commit results.json → agent branch      │
          │  7. Post ADF comment + transition → Jira    │
          └─────────────────────────────────────────────┘
```

---

## Why two branches?

| | `main` | `agent/auto-tests` |
|---|---|---|
| **Contents** | `ci.yml`, `package.json`, `src/`, `scripts/` | `tests/generated/*.spec.ts`, `playwright.config.ts`, `playwright-report/results.json` |
| **Written by** | Developer (manual commits) | Agent (every pipeline run) |
| **CI reads** | Workflow definition | Generated test files (via git overlay) |
| **Purpose** | Stable source of truth | Ephemeral — overwritten each run |

`workflow_dispatch` requires `ci.yml` to live on `main`. Generated tests are committed to `agent/auto-tests` so they don't pollute the stable codebase. The CI job overlays both at runtime.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| macOS | 12+ | — |
| Node.js | ≥ 20 | via nvm |
| npm | ≥ 10 | bundled with Node |
| Git | any | Xcode CLT / Homebrew |
| GitHub CLI | any | `brew install gh` |
| SQLite | 3.x | pre-installed on macOS |
| Google Chrome | any | recommended for new-session browser opens |

---

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/agentic-ai-playwright-poc.git
cd agentic-ai-playwright-poc
bash setup-mac.sh
```

### 2. Configure secrets

```bash
cp .env.example .env
# Edit .env with your real keys
```

| Variable | Where to get it |
|----------|----------------|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/keys |
| `JIRA_HOST` | e.g. `mycompany.atlassian.net` — no `https://`, no trailing slash |
| `JIRA_EMAIL` | Your Atlassian login email |
| `JIRA_API_TOKEN` | https://id.atlassian.com/manage-profile/security/api-tokens |
| `JIRA_ISSUE_KEY` | Default issue key fallback e.g. `AQA-1` (you can override at runtime) |
| `GITHUB_TOKEN` | Fine-grained PAT — permissions: Contents, Actions, Workflows, Secrets (all Read & write) |
| `GITHUB_OWNER` | Your GitHub username |
| `GITHUB_REPO` | `agentic-ai-playwright-poc` |
| `GITHUB_BRANCH` | `agent/auto-tests` |
| `DB_PATH` | `./data/users.db` (default, no change needed) |

### 3. Create the GitHub repo

Create `agentic-ai-playwright-poc` on github.com first, then:

```bash
bash scripts/init-github-repo.sh
```

This authenticates the GitHub CLI, pushes the initial scaffold to `main`, and sets all four Jira credentials as GitHub Actions secrets.

### 4. Seed the database

```bash
npm run db:init
```

Creates `data/users.db` with two records:

| id | name | export_status | username | password |
|----|------|--------------|----------|----------|
| 1 | Captain America | US_PERSON | captain.america | Avengers2025! |
| 2 | Green Goblin | NON_US_PERSON | green.goblin | OsCorp2025! |

### 5. Push `ci.yml` to main

```bash
git add .github/workflows/ci.yml
git commit -m "chore: add CI workflow"
git push origin main
```

### 6. Run the agent

```bash
npm run agent
```

---

## What happens during a run

```
Step 0  Interactive prompt — collect Jira keys + plain-English test cases
Step 1  Ensure GitHub repo exists
Step 2  Preview SQLite users (shown for context — tests load them at runtime)
Step 3  Prepare agent/auto-tests branch + commit shared files
Step 4  For each story: fetch Jira → Claude generates test scaffold → commit
Step 5  Trigger GitHub Actions workflow_dispatch on main
Step 6  Poll every 15s until workflow completes
Step 7  Fetch results.json from agent branch → build HTML dashboard → save
Step 7b Save animated login demo UI → open both in a new browser session
Step 8  Post ADF comment (with test results table) to every Jira story
        Transition each story → Done if tests passed
```

---

## Test generation design

Tests are **template-driven**, not free-form. The agent builds the file structure; Claude only writes the assertion body for each test case.

- The file header (`import`, `interface`, helper functions) is always identical
- One plain-English test case → exactly one `test()` block — no extras
- Tests call `GET /api/users` at runtime to discover all DB users dynamically
- Passwords come from the `/api/users` response — nothing is hardcoded
- If no plain-English cases are entered, two default tests (US_PERSON pass / NON_US_PERSON fail) are used

---

## Mock server endpoints

The Express server (`scripts/mockServer.ts`) runs in CI and locally:

| Endpoint | Description |
|----------|-------------|
| `GET /api/users` | All users from SQLite including password — used by tests at runtime |
| `GET /api/login?username=u&password=p` | Export-control login check |
| `GET /health` | Liveness probe used by CI startup check |

Server messages:
- **US_PERSON success:** `"Login successful. Welcome!"`
- **NON_US_PERSON blocked:** `"Only US Persons are allowed to watch this demo."`

---

## Local reports

After each run, two HTML files are saved to `local-reports/` and opened in a new Chrome/Safari session:

| File | Contents |
|------|----------|
| `report-<runId>.html` | Dark-theme test dashboard — pass/fail per test, durations, pass rate bar, link to GitHub Actions run |
| `login-ui-<runId>.html` | Animated login demo UI — Captain America (access granted) and Green Goblin (access denied) with exact server messages |

---

## Project structure

```
agentic-ai-playwright-poc/
├── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml                   # GitHub Actions — runs on main, overlays tests from agent branch
├── data/
│   └── users.db                     # Auto-created by npm run db:init
├── local-reports/                   # Auto-generated after each run (git-ignored)
│   ├── report-<id>.html             # Test results dashboard
│   └── login-ui-<id>.html          # Animated login demo UI
├── scripts/
│   ├── init-github-repo.sh          # One-time GitHub setup
│   └── mockServer.ts                # Express login + users API (dev + CI)
├── src/
│   ├── agent/
│   │   ├── index.ts                 # 🤖 Main orchestrator (8-step pipeline)
│   │   ├── prompt.ts                # Interactive terminal prompt
│   │   ├── testGenerator.ts         # Template-based test file builder
│   │   ├── report.ts                # results.json fetcher + HTML dashboard
│   │   └── loginUi.ts              # Animated login demo UI generator
│   ├── db/
│   │   ├── client.ts                # SQLite query helpers
│   │   └── seed.ts                  # Database seeder
│   ├── github/
│   │   └── client.ts                # Octokit wrapper
│   └── jira/
│       └── client.ts                # Atlassian REST API v3 wrapper
├── DEMO_GUIDE.md                    # Presenter guide with example session
├── package.json
├── setup-mac.sh                     # macOS bootstrap script
└── tsconfig.json
```

---

## Database schema

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  export_status TEXT    NOT NULL CHECK(export_status IN ('US_PERSON','NON_US_PERSON')),
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL
);
```

Adding more users to this table requires no test code changes — tests discover all users dynamically at runtime via `GET /api/users`.

---

## GitHub Actions secrets required

Set under **Settings → Secrets and variables → Actions** (done automatically by `init-github-repo.sh`):

| Secret | Value |
|--------|-------|
| `JIRA_HOST` | e.g. `mycompany.atlassian.net` |
| `JIRA_EMAIL` | Your Atlassian email |
| `JIRA_API_TOKEN` | Your Atlassian API token |
| `JIRA_ISSUE_KEY` | Fallback issue key e.g. `AQA-1` |

---

## Re-running the demo

Run `npm run agent` as many times as needed. Each run:
- Overwrites `tests/generated/<ISSUE-KEY>.spec.ts` on the agent branch with freshly generated tests
- Adds a new timestamped comment to each Jira ticket
- Overwrites `local-reports/` files with the latest results
- Opens a fresh browser session with the new reports

The Jira ticket accumulates a comment history showing each pipeline run — useful for demonstrating the agentic loop to an audience.

---

## Security notes

- Passwords in the seed DB are stored plain-text **for demo purposes only**. Use bcrypt/argon2 in production.
- `/api/users` returns passwords **for demo purposes only**. Never expose credentials via API in production.
- Never commit a populated `.env` file — it is in `.gitignore`.
- The GitHub fine-grained PAT should be scoped to this repository only and set to expire after the demo period.
