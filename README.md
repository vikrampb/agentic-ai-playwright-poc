# Agentic AI Playwright POC

An end-to-end **Agentic AI framework** that autonomously:

1. **Creates a GitHub repository** to store generated tests
2. **Reads a Jira user story** via the Atlassian REST API
3. **Queries an embedded SQLite database** for test data
4. **Calls Claude** (claude-sonnet-4-6) to generate Playwright TypeScript tests
5. **Commits & pushes** the tests to GitHub
6. **Triggers GitHub Actions** CI/CD
7. **Posts results back to Jira** (comment + status transition)

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Your MacBook                       │
│                                                     │
│  npm run agent                                      │
│       │                                             │
│       ▼                                             │
│  ┌──────────────────────────────────────────────┐   │
│  │          src/agent/index.ts  (Orchestrator)  │   │
│  └──────────┬──────────────────────────────┬────┘   │
│             │                              │        │
│     ┌───────▼──────┐            ┌──────────▼──────┐ │
│     │  Jira Client │            │  SQLite DB      │ │
│     │  (REST API)  │            │  data/users.db  │ │
│     └───────┬──────┘            └──────────┬──────┘ │
│             │                              │        │
│     ┌───────▼──────────────────────────────▼──────┐ │
│     │   Claude API  (test generator)              │ │
│     │   claude-sonnet-4-6                         │ │
│     └───────────────────┬───────────────────────┘  │
│                         │                           │
│                ┌────────▼────────┐                  │
│                │  GitHub Client  │                  │
│                │  (Octokit)      │                  │
│                └────────┬────────┘                  │
└─────────────────────────┼───────────────────────────┘
                          │
           ┌──────────────▼──────────────────────┐
           │            GitHub                   │
           │  • Creates / pushes branch           │
           │  • Triggers ci.yml workflow          │
           │  • Playwright tests run in Actions  │
           │  • Results → Jira comment           │
           └──────────────────────────────────────┘
```

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

---

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/agentic-ai-playwright-poc.git
cd agentic-ai-playwright-poc

# One-shot macOS setup (Homebrew, nvm, Node 20, npm deps, Playwright browsers)
bash setup-mac.sh
```

### 2. Configure secrets

```bash
cp .env.example .env
# Edit .env with your real keys (see table below)
```

| Variable | Where to get it |
|----------|----------------|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/keys |
| `JIRA_HOST` | e.g. `mycompany.atlassian.net` |
| `JIRA_EMAIL` | Your Atlassian login email |
| `JIRA_API_TOKEN` | https://id.atlassian.com/manage-profile/security/api-tokens |
| `JIRA_ISSUE_KEY` | e.g. `PROJ-42` |
| `GITHUB_TOKEN` | https://github.com/settings/tokens — scopes: `repo`, `workflow` |
| `GITHUB_OWNER` | Your GitHub username |
| `GITHUB_REPO` | `agentic-ai-playwright-poc` (or any name) |
| `GITHUB_BRANCH` | `agent/auto-tests` |
| `DB_PATH` | `./data/users.db` (default, no change needed) |

### 3. Create the GitHub repo & set secrets

```bash
bash scripts/init-github-repo.sh
```

### 4. Seed the database

```bash
npm run db:init
```

Prints the seeded users table:

| id | name | export_status | username |
|----|------|--------------|----------|
| 1 | Captain America | US_PERSON | captain.america |
| 2 | Green Goblin | NON_US_PERSON | green.goblin |

### 5. Run the agent!

```bash
npm run agent
```

The pipeline will:
- Read your Jira story
- Generate tests via Claude
- Push to GitHub
- Trigger CI
- Wait for results
- Post back to Jira

---

## Running tests locally

```bash
# Start the mock server
npx ts-node scripts/mockServer.ts &

# Run Playwright
npx playwright test

# View the HTML report
npx playwright show-report
```

---

## Project structure

```
agentic-ai-playwright-poc/
├── .env.example                    # Secret template
├── .github/
│   └── workflows/
│       └── ci.yml                  # GitHub Actions (Playwright + Jira)
├── data/
│   └── users.db                    # Auto-created by db:init
├── scripts/
│   ├── init-github-repo.sh         # One-time GitHub setup
│   └── mockServer.ts               # Express login API (dev + CI)
├── src/
│   ├── agent/
│   │   ├── index.ts                # 🤖 Main orchestrator
│   │   └── testGenerator.ts        # Claude test-generation module
│   ├── db/
│   │   ├── client.ts               # SQLite query helpers
│   │   └── seed.ts                 # Database initialiser
│   ├── github/
│   │   └── client.ts               # Octokit wrapper
│   └── jira/
│       └── client.ts               # Atlassian REST API wrapper
├── tests/
│   └── generated/
│       └── LOGIN-EXPORT-CONTROL.spec.ts  # Static seed + agent output
├── package.json
├── playwright.config.ts
├── setup-mac.sh                    # macOS bootstrap
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

---

## GitHub Actions secrets required

Set these in your repo under **Settings → Secrets and variables → Actions**:

- `JIRA_HOST`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`
- `JIRA_ISSUE_KEY`

`init-github-repo.sh` does this automatically via `gh secret set`.

---

## Jira story template

Create a Jira story with content similar to:

> **Summary:** Login feature with export control
>
> **Description:**
> As a user, I want to log in to the application so that I can access its features.
> The system must enforce export control regulations: only US Persons may log in.
> Non-US Persons must be shown a clear, graceful error message.
>
> **Acceptance Criteria:**
> - GIVEN a US Person's credentials, WHEN they log in, THEN they receive a success response
> - GIVEN a Non-US Person's credentials, WHEN they log in, THEN they receive a clear denial message
> - The denial message must be human-readable and not expose internal details

---

## Security notes

- Passwords in the seed DB are plain-text **for demo purposes only**. Use bcrypt/argon2 in production.
- Never commit a populated `.env` file. It is in `.gitignore`.
- The GitHub token needs `repo` + `workflow` scopes only.
