#!/bin/bash
# scripts/init-github-repo.sh
# Run ONCE after filling in .env to create the repo and configure secrets.
set -e

source .env

REPO_NAME="${GITHUB_REPO:-agentic-ai-playwright-poc}"
OWNER="${GITHUB_OWNER}"

echo "🔐  Authenticating with GitHub CLI..."
gh auth status || gh auth login

echo ""
echo "📦  Creating GitHub repo: ${OWNER}/${REPO_NAME}"
gh repo create "${REPO_NAME}" \
  --public \
  --description "Agentic AI POC: Claude reads Jira → generates Playwright tests → GitHub Actions CI/CD" \
  --clone \
  || echo "  (Repo already exists – continuing)"

echo ""
echo "🔑  Setting GitHub Actions Secrets..."
gh secret set JIRA_HOST      --body "${JIRA_HOST}"      --repo "${OWNER}/${REPO_NAME}"
gh secret set JIRA_EMAIL     --body "${JIRA_EMAIL}"     --repo "${OWNER}/${REPO_NAME}"
gh secret set JIRA_API_TOKEN --body "${JIRA_API_TOKEN}" --repo "${OWNER}/${REPO_NAME}"
gh secret set JIRA_ISSUE_KEY --body "${JIRA_ISSUE_KEY}" --repo "${OWNER}/${REPO_NAME}"

echo ""
echo "🌿  Pushing initial code to main..."
git init -b main 2>/dev/null || true
git remote add origin "https://github.com/${OWNER}/${REPO_NAME}.git" 2>/dev/null || true
git add .
git commit -m "chore: initial Agentic AI POC scaffold" --allow-empty
git push -u origin main --force

echo ""
echo "✅  GitHub repo ready: https://github.com/${OWNER}/${REPO_NAME}"
echo "    Secrets configured; GitHub Actions workflow at .github/workflows/ci.yml"
echo ""
echo "Next step: run  npm run agent  to start the pipeline!"
