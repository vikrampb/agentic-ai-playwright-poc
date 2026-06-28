/**
 * src/agent/loginUi.ts
 * Generates an animated HTML login UI from actual test results.
 * Only shows login attempts for tests that were actually run —
 * derived from RunSummary.tests, not hardcoded.
 */
import * as fs   from 'fs';
import * as path from 'path';
import { RunSummary, TestResult } from './report';

// ── Map a test result to a login attempt card ─────────────────────────────────
interface LoginAttempt {
  name:         string;
  username:     string;
  exportStatus: string;
  success:      boolean;
  message:      string;
  avatar:       string;
  avatarColor:  string;
  delay:        number;
}

function testToAttempt(t: TestResult, index: number): LoginAttempt | null {
  const title = t.testTitle.toLowerCase() + ' ' + t.suiteName.toLowerCase();

  // Determine if this test is about a US or Non-US person
  const isUsTest  = title.includes('us_person') && !title.includes('non_us') ||
                    title.includes('successful') || title.includes('pass') ||
                    title.includes('succeed') || title.includes('granted');
  const isNonUs   = title.includes('non_us') || title.includes('non-us') ||
                    title.includes('fail') || title.includes('denied') ||
                    title.includes('blocked') || title.includes('restricted');

  if (!isUsTest && !isNonUs) return null;

  const success = isUsTest && !isNonUs;

  // Derive a display name from the test title
  // Use the test title itself as the scenario label
  const scenarioLabel = t.testTitle
    .replace(/^(login|verify|check|test|assert)\s+/i, '')
    .replace(/\b(if|the|an?|that|is|are|should|must|will)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const colors = ['#1565C0', '#2E7D32', '#6A1B9A', '#C62828', '#00695C', '#E65100'];
  const avatarColor = colors[index % colors.length];
  const avatarLetters = scenarioLabel.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');

  return {
    name:         scenarioLabel.length > 40 ? scenarioLabel.slice(0, 37) + '…' : scenarioLabel,
    username:     success ? 'us.user' : 'non.us.user',
    exportStatus: success ? 'US_PERSON' : 'NON_US_PERSON',
    success,
    message:      success
      ? 'Login successful. Welcome!'
      : 'Only US Persons are allowed to watch this demo.',
    avatar:       avatarLetters || (success ? 'US' : 'NU'),
    avatarColor,
    delay:        index * 700,
  };
}

// ── Build the HTML ────────────────────────────────────────────────────────────
export function buildLoginUi(summary: RunSummary, runId: number): string {
  // Derive login attempts from actual test results
  const attempts: LoginAttempt[] = summary.tests
    .map((t, i) => testToAttempt(t, i))
    .filter((a): a is LoginAttempt => a !== null);

  // If we couldn't parse any from test titles, fall back to summary-level info
  const displayAttempts: LoginAttempt[] = attempts.length > 0 ? attempts : [
    {
      name: 'Test Run', username: 'user', exportStatus: 'UNKNOWN',
      success: summary.conclusion === 'success',
      message: summary.conclusion === 'success' ? 'Login successful. Welcome!' : 'Access denied.',
      avatar: 'TR', avatarColor: '#1565C0', delay: 0,
    },
  ];

  const overallIcon  = summary.conclusion === 'success' ? '✅' : '❌';
  const overallColor = summary.conclusion === 'success' ? '#02C39A' : '#E24B4A';
  const passRate     = summary.totalTests > 0
    ? Math.round((summary.passed / summary.totalTests) * 100) : 0;

  const cards = displayAttempts.map((a) => `
    <div class="attempt-card" style="animation-delay:${a.delay}ms">
      <div class="card-header">
        <div class="avatar" style="background:${a.avatarColor}">${a.avatar}</div>
        <div class="user-info">
          <div class="user-name">${a.name}</div>
          <div class="user-meta">
            <span class="status-badge ${a.exportStatus === 'US_PERSON' ? 'us' : 'non-us'}">${a.exportStatus}</span>
          </div>
        </div>
      </div>

      <div class="login-form">
        <div class="field"><label>Username</label><div class="input-mock">${a.username}</div></div>
        <div class="field"><label>Password</label><div class="input-mock">••••••••••••</div></div>
        <div class="login-btn">Sign In</div>
      </div>

      <div class="result ${a.success ? 'result-success' : 'result-fail'}" style="animation-delay:${a.delay + 500}ms">
        <div class="result-icon">${a.success ? '✓' : '✕'}</div>
        <div class="result-text">
          <div class="result-title">${a.success ? 'Access Granted' : 'Access Denied'}</div>
          <div class="result-message">${a.message}</div>
        </div>
      </div>
    </div>`).join('');

  const gridCols = displayAttempts.length === 1 ? '1fr' :
                   displayAttempts.length === 2 ? '1fr 1fr' : 'repeat(auto-fit,minmax(280px,1fr))';

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
  .page-title{font-size:11px;color:#64748b;text-align:center;margin-bottom:0.4rem;
              letter-spacing:.06em;text-transform:uppercase}
  .page-heading{font-size:20px;font-weight:500;text-align:center;color:#f8fafc;margin-bottom:0.3rem}
  .page-sub{font-size:12px;color:#64748b;text-align:center;margin-bottom:1rem}
  .overall-badge{display:inline-flex;align-items:center;gap:6px;padding:3px 14px;
                 border-radius:999px;font-size:12px;font-weight:500;margin-bottom:1.75rem;
                 background:${overallColor}22;color:${overallColor};border:1px solid ${overallColor}44}
  .badge-wrap{text-align:center}
  .grid{display:grid;grid-template-columns:${gridCols};gap:1.25rem;
        width:100%;max-width:${displayAttempts.length === 1 ? '380px' : '760px'}}
  .attempt-card{background:#1e293b;border:0.5px solid #334155;border-radius:14px;
                padding:1.25rem;animation:slideIn 0.5s ease both}
  @keyframes slideIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  .card-header{display:flex;align-items:center;gap:10px;margin-bottom:1.1rem}
  .avatar{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;
          justify-content:center;font-weight:600;font-size:13px;color:#fff;flex-shrink:0}
  .user-name{font-size:13px;font-weight:500;color:#f1f5f9;line-height:1.3}
  .user-meta{margin-top:4px}
  .status-badge{display:inline-block;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:500}
  .status-badge.us{background:#02C39A22;color:#02C39A}
  .status-badge.non-us{background:#E24B4A22;color:#E24B4A}
  .login-form{background:#0f172a;border-radius:8px;padding:0.85rem;margin-bottom:0.85rem}
  .field{margin-bottom:0.6rem}
  .field:last-child{margin-bottom:0.75rem}
  label{font-size:10px;color:#64748b;display:block;margin-bottom:3px;
        text-transform:uppercase;letter-spacing:.04em}
  .input-mock{background:#1e293b;border:0.5px solid #334155;border-radius:5px;
              padding:7px 10px;font-size:12px;color:#94a3b8}
  .login-btn{background:#3b82f6;color:#fff;border-radius:6px;padding:8px;
             text-align:center;font-size:12px;font-weight:500}
  .result{display:flex;align-items:flex-start;gap:9px;padding:0.8rem;
          border-radius:9px;animation:fadeIn 0.4s ease both}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  .result-success{background:#02C39A15;border:0.5px solid #02C39A44}
  .result-fail{background:#E24B4A15;border:0.5px solid #E24B4A44}
  .result-icon{font-size:17px;font-weight:700;flex-shrink:0;line-height:1.2}
  .result-success .result-icon{color:#02C39A}
  .result-fail    .result-icon{color:#E24B4A}
  .result-title{font-size:12px;font-weight:500;margin-bottom:3px}
  .result-success .result-title{color:#02C39A}
  .result-fail    .result-title{color:#E24B4A}
  .result-message{font-size:11px;color:#94a3b8;line-height:1.5}
  .stats{display:flex;gap:1.5rem;justify-content:center;margin-bottom:1.5rem;flex-wrap:wrap}
  .stat{text-align:center}
  .stat-num{font-size:22px;font-weight:600;color:#f1f5f9}
  .stat-lbl{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
  .footer{margin-top:1.5rem;font-size:11px;color:#475569;text-align:center}
  .footer a{color:#4FC3F7;text-decoration:none}
</style>
</head>
<body>

<p class="page-title">Agentic AI POC</p>
<h1 class="page-heading">Export Control Login Demo</h1>
<p class="page-sub">Run #${runId} &nbsp;·&nbsp; ${summary.startedAt}</p>

<div class="badge-wrap">
  <span class="overall-badge">${overallIcon} Tests ${summary.conclusion.toUpperCase()}</span>
</div>

<div class="stats">
  <div class="stat"><div class="stat-num" style="color:#02C39A">${summary.passed}</div><div class="stat-lbl">Passed</div></div>
  <div class="stat"><div class="stat-num" style="color:#E24B4A">${summary.failed}</div><div class="stat-lbl">Failed</div></div>
  <div class="stat"><div class="stat-num">${passRate}%</div><div class="stat-lbl">Pass rate</div></div>
  <div class="stat"><div class="stat-num" style="color:#4FC3F7">${(summary.durationMs / 1000).toFixed(1)}s</div><div class="stat-lbl">Duration</div></div>
</div>

<div class="grid">${cards}</div>

<div class="footer">
  <a href="${summary.runUrl}" target="_blank">View GitHub Actions run ↗</a>
  &nbsp;·&nbsp; Tests generated by Claude (claude-sonnet-4-6)
</div>

</body>
</html>`;
}

/** Save the login UI HTML and return its path. */
export function saveLoginUi(summary: RunSummary, runId: number): string {
  const html       = buildLoginUi(summary, runId);
  const reportsDir = path.join(process.cwd(), 'local-reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const outPath    = path.join(reportsDir, `login-ui-${runId}.html`);
  fs.writeFileSync(outPath, html, 'utf-8');
  console.log(`   💾  Login UI saved: ${outPath}`);
  return outPath;
}
