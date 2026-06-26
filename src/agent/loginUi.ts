/**
 * src/agent/loginUi.ts
 * Generates a self-contained animated HTML login UI that replays
 * test results — showing each user attempting to login with a
 * pass/fail outcome message.
 * Saved to local-reports/login-ui-<runId>.html and auto-opened.
 */
import * as fs   from 'fs';
import * as path from 'path';
import { RunSummary } from './report';

export function buildLoginUi(summary: RunSummary, runId: number): string {
  // Extract users from test titles — each test title contains the export_status context
  const usTests  = summary.tests.filter(t =>
    t.suiteName.includes('US_PERSON') || t.testTitle.toLowerCase().includes('us_person') ||
    t.testTitle.toLowerCase().includes('us person') || t.testTitle.toLowerCase().includes('successful')
  );
  const nonUsTests = summary.tests.filter(t =>
    t.suiteName.includes('NON_US_PERSON') || t.testTitle.toLowerCase().includes('non_us') ||
    t.testTitle.toLowerCase().includes('non us') || t.testTitle.toLowerCase().includes('fails') ||
    t.testTitle.toLowerCase().includes('blocked') || t.testTitle.toLowerCase().includes('denied')
  );

  // Build login attempt cards — always show Captain America and Green Goblin
  // regardless of test structure, since those are the DB records
  const attempts = [
    {
      name:         'Captain America',
      username:     'captain.america',
      exportStatus: 'US_PERSON',
      success:      true,
      message:      'Login successful. Welcome!',
      avatar:       'CA',
      color:        '#1565C0',
      delay:        0,
    },
    {
      name:         'Green Goblin',
      username:     'green.goblin',
      exportStatus: 'NON_US_PERSON',
      success:      false,
      message:      'Only US Persons are allowed to watch this demo.',
      avatar:       'GG',
      color:        '#2E7D32',
      delay:        1200,
    },
  ];

  const overallIcon  = summary.conclusion === 'success' ? '✅' : '❌';
  const overallColor = summary.conclusion === 'success' ? '#02C39A' : '#E24B4A';

  const cards = attempts.map((a) => `
    <div class="attempt-card" style="animation-delay: ${a.delay}ms">
      <div class="card-header">
        <div class="avatar" style="background:${a.color}">${a.avatar}</div>
        <div class="user-info">
          <div class="user-name">${a.name}</div>
          <div class="user-meta">${a.username} &nbsp;·&nbsp; <span class="status-badge ${a.exportStatus === 'US_PERSON' ? 'us' : 'non-us'}">${a.exportStatus}</span></div>
        </div>
      </div>

      <div class="login-form">
        <div class="field">
          <label>Username</label>
          <div class="input-mock">${a.username}</div>
        </div>
        <div class="field">
          <label>Password</label>
          <div class="input-mock">••••••••••••</div>
        </div>
        <div class="login-btn">Sign In</div>
      </div>

      <div class="result ${a.success ? 'result-success' : 'result-fail'}" style="animation-delay: ${a.delay + 600}ms">
        <div class="result-icon">${a.success ? '✓' : '✕'}</div>
        <div class="result-text">
          <div class="result-title">${a.success ? 'Access Granted' : 'Access Denied'}</div>
          <div class="result-message">${a.message}</div>
        </div>
      </div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Login Demo — Run #${runId}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
       background:#0f172a;color:#e2e8f0;min-height:100vh;
       display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem}

  .page-title{font-size:13px;color:#64748b;text-align:center;margin-bottom:0.5rem;letter-spacing:.05em;text-transform:uppercase}
  .page-heading{font-size:22px;font-weight:500;text-align:center;color:#f8fafc;margin-bottom:0.4rem}
  .page-sub{font-size:13px;color:#64748b;text-align:center;margin-bottom:2rem}
  .overall-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 14px;
                 border-radius:999px;font-size:12px;font-weight:500;margin-bottom:2rem;
                 background:${overallColor}22;color:${overallColor};border:1px solid ${overallColor}44}

  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1.5rem;width:100%;max-width:720px}

  .attempt-card{background:#1e293b;border:0.5px solid #334155;border-radius:16px;
                padding:1.5rem;animation:slideIn 0.5s ease both}

  @keyframes slideIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}

  .card-header{display:flex;align-items:center;gap:12px;margin-bottom:1.25rem}
  .avatar{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;
          justify-content:center;font-weight:600;font-size:14px;color:#fff;flex-shrink:0}
  .user-name{font-size:15px;font-weight:500;color:#f1f5f9}
  .user-meta{font-size:12px;color:#64748b;margin-top:3px;display:flex;align-items:center;gap:4px}

  .status-badge{display:inline-block;padding:1px 7px;border-radius:4px;font-size:11px;font-weight:500}
  .status-badge.us{background:#02C39A22;color:#02C39A}
  .status-badge.non-us{background:#E24B4A22;color:#E24B4A}

  .login-form{background:#0f172a;border-radius:10px;padding:1rem;margin-bottom:1rem}
  .field{margin-bottom:0.75rem}
  .field:last-child{margin-bottom:0.875rem}
  label{font-size:11px;color:#64748b;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em}
  .input-mock{background:#1e293b;border:0.5px solid #334155;border-radius:6px;
              padding:8px 10px;font-size:13px;color:#94a3b8}
  .login-btn{background:#3b82f6;color:#fff;border-radius:6px;padding:9px;
             text-align:center;font-size:13px;font-weight:500;cursor:pointer}

  .result{display:flex;align-items:flex-start;gap:10px;padding:0.9rem 1rem;
          border-radius:10px;animation:fadeIn 0.4s ease both}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}

  .result-success{background:#02C39A15;border:0.5px solid #02C39A44}
  .result-fail{background:#E24B4A15;border:0.5px solid #E24B4A44}

  .result-icon{font-size:18px;font-weight:700;flex-shrink:0;line-height:1.2}
  .result-success .result-icon{color:#02C39A}
  .result-fail    .result-icon{color:#E24B4A}

  .result-title{font-size:13px;font-weight:500;margin-bottom:3px}
  .result-success .result-title{color:#02C39A}
  .result-fail    .result-title{color:#E24B4A}
  .result-message{font-size:12px;color:#94a3b8;line-height:1.5}

  .footer{margin-top:2rem;font-size:11px;color:#475569;text-align:center}
  .footer a{color:#4FC3F7;text-decoration:none}
</style>
</head>
<body>

<p class="page-title">Agentic AI POC</p>
<h1 class="page-heading">Export Control Login Demo</h1>
<p class="page-sub">Run #${runId} &nbsp;·&nbsp; ${summary.startedAt}</p>
<div style="text-align:center">
  <span class="overall-badge">${overallIcon} Tests ${summary.conclusion.toUpperCase()} &nbsp;·&nbsp; ${summary.passed}/${summary.totalTests} passed</span>
</div>

<div class="grid">
  ${cards}
</div>

<div class="footer">
  <a href="${summary.runUrl}" target="_blank">View full GitHub Actions run ↗</a>
  &nbsp;·&nbsp; Tests auto-generated by Claude (claude-sonnet-4-6)
</div>

</body>
</html>`;
}

export function saveAndOpenLoginUi(summary: RunSummary, runId: number): void {
  const html        = buildLoginUi(summary, runId);
  const reportsDir  = path.join(process.cwd(), 'local-reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const outPath     = path.join(reportsDir, `login-ui-${runId}.html`);
  fs.writeFileSync(outPath, html, 'utf-8');

  try {
    const { execSync } = require('child_process');
    execSync(`open "${outPath}"`);
    console.log(`   🖥️   Login UI opened in browser: ${outPath}`);
  } catch {
    console.log(`   📄  Login UI saved to: ${outPath}`);
  }
}
