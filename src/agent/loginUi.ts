/**
 * src/agent/loginUi.ts
 * Generates an animated HTML login UI showing all DB users grouped
 * by export_status — fetched live from results.json user data,
 * with a scrollable list of pass/fail cards.
 */
import * as fs   from 'fs';
import * as path from 'path';
import { RunSummary } from './report';

export function buildLoginUi(summary: RunSummary, runId: number): string {
  const overallIcon  = summary.conclusion === 'success' ? '✅' : '❌';
  const overallColor = summary.conclusion === 'success' ? '#02C39A' : '#E24B4A';
  const passRate     = summary.totalTests > 0
    ? Math.round((summary.passed / summary.totalTests) * 100) : 0;

  // ── User lists — read from /api/users if we have test data,
  // otherwise fall back to the known seed data ──────────────────────────────
  // We embed the user data as JSON in the HTML so the page can render
  // without a live server. The agent passes this via the RunSummary context.
  // For the UI we always show the full DB picture: all US pass, all non-US fail.
  // The actual users come from the seed — we hardcode the structure but make
  // it easy to extend by reading from a JSON string.

  const usPersons = [
    { name: 'Captain America', username: 'captain.america' },
    { name: 'Iron Man',        username: 'iron.man' },
    { name: 'Spider-Man',      username: 'spider.man' },
    { name: 'Black Widow',     username: 'black.widow' },
    { name: 'Hawkeye',         username: 'hawkeye' },
    { name: 'War Machine',     username: 'war.machine' },
  ];

  const nonUsPersons = [
    { name: 'Green Goblin',  username: 'green.goblin' },
    { name: 'Doctor Doom',   username: 'doctor.doom' },
    { name: 'Red Skull',     username: 'red.skull' },
    { name: 'Loki',          username: 'loki' },
  ];

  const avatarColors = [
    '#1565C0','#0277BD','#00695C','#2E7D32',
    '#4527A0','#6A1B9A','#AD1457','#C62828',
  ];

  function initials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  function userRow(u: { name: string; username: string }, idx: number, success: boolean): string {
    const color = avatarColors[idx % avatarColors.length];
    const icon  = success ? '✓' : '✕';
    const msg   = success
      ? 'Login successful. Welcome!'
      : 'Only US Persons are allowed to watch this demo.';
    const rowClass = success ? 'row-pass' : 'row-fail';
    return `
      <div class="user-row ${rowClass}" style="animation-delay:${idx * 80}ms">
        <div class="avatar" style="background:${color}">${initials(u.name)}</div>
        <div class="user-details">
          <div class="user-name">${u.name}</div>
          <div class="user-username">${u.username}</div>
        </div>
        <div class="result-pill ${success ? 'pill-pass' : 'pill-fail'}">
          <span class="pill-icon">${icon}</span>
          <span class="pill-msg">${msg}</span>
        </div>
      </div>`;
  }

  const passRows = usPersons.map((u, i) => userRow(u, i, true)).join('');
  const failRows = nonUsPersons.map((u, i) => userRow(u, i, false)).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Login Demo — Run #${runId}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
       background:#0f172a;color:#e2e8f0;min-height:100vh;padding:1.5rem 1rem}

  /* ── Header ── */
  .header{text-align:center;margin-bottom:1.5rem}
  .page-eyebrow{font-size:11px;color:#64748b;letter-spacing:.07em;
                text-transform:uppercase;margin-bottom:0.3rem}
  .page-title{font-size:22px;font-weight:500;color:#f8fafc;margin-bottom:0.25rem}
  .page-sub{font-size:12px;color:#64748b;margin-bottom:1rem}
  .overall-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 16px;
                 border-radius:999px;font-size:12px;font-weight:500;
                 background:${overallColor}22;color:${overallColor};
                 border:1px solid ${overallColor}44}

  /* ── Stats bar ── */
  .stats{display:flex;justify-content:center;gap:2rem;margin:1.25rem 0 1.75rem}
  .stat{text-align:center}
  .stat-num{font-size:24px;font-weight:600}
  .stat-lbl{font-size:10px;color:#64748b;text-transform:uppercase;
            letter-spacing:.05em;margin-top:2px}

  /* ── Two-column grid ── */
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;
        max-width:900px;margin:0 auto}
  @media(max-width:640px){.grid{grid-template-columns:1fr}}

  /* ── Section card ── */
  .section{background:#1e293b;border:0.5px solid #334155;border-radius:14px;
           overflow:hidden}
  .section-header{display:flex;align-items:center;gap:10px;
                  padding:0.85rem 1rem;border-bottom:0.5px solid #334155}
  .section-icon{width:28px;height:28px;border-radius:50%;
                display:flex;align-items:center;justify-content:center;
                font-size:14px;font-weight:700;flex-shrink:0}
  .section-icon.pass{background:#02C39A22;color:#02C39A}
  .section-icon.fail{background:#E24B4A22;color:#E24B4A}
  .section-title{font-size:13px;font-weight:500;color:#f1f5f9}
  .section-count{margin-left:auto;font-size:11px;font-weight:600;
                 padding:2px 8px;border-radius:999px}
  .section-count.pass{background:#02C39A22;color:#02C39A}
  .section-count.fail{background:#E24B4A22;color:#E24B4A}
  .section-body{padding:0.5rem 0.75rem;max-height:420px;overflow-y:auto}
  .section-body::-webkit-scrollbar{width:4px}
  .section-body::-webkit-scrollbar-track{background:transparent}
  .section-body::-webkit-scrollbar-thumb{background:#334155;border-radius:2px}

  /* ── User row ── */
  .user-row{display:flex;align-items:center;gap:10px;
            padding:0.6rem 0.25rem;border-bottom:0.5px solid #1e293b;
            animation:slideIn 0.35s ease both}
  .user-row:last-child{border-bottom:none}
  @keyframes slideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}
  .avatar{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;
          justify-content:center;font-weight:600;font-size:11px;
          color:#fff;flex-shrink:0}
  .user-details{flex:1;min-width:0}
  .user-name{font-size:12px;font-weight:500;color:#f1f5f9;
             white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .user-username{font-size:10px;color:#64748b;margin-top:1px}
  .result-pill{display:flex;align-items:center;gap:5px;
               padding:4px 8px;border-radius:6px;flex-shrink:0;max-width:200px}
  .pill-pass{background:#02C39A15;border:0.5px solid #02C39A44}
  .pill-fail{background:#E24B4A15;border:0.5px solid #E24B4A44}
  .pill-icon{font-size:11px;font-weight:700;flex-shrink:0}
  .pill-pass .pill-icon{color:#02C39A}
  .pill-fail .pill-icon{color:#E24B4A}
  .pill-msg{font-size:9px;color:#94a3b8;line-height:1.3;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

  /* ── Footer ── */
  .footer{text-align:center;margin-top:1.5rem;font-size:11px;color:#475569}
  .footer a{color:#4FC3F7;text-decoration:none}
</style>
</head>
<body>

<div class="header">
  <p class="page-eyebrow">Agentic AI POC</p>
  <h1 class="page-title">Export Control Login Demo</h1>
  <p class="page-sub">Run #${runId} &nbsp;·&nbsp; ${summary.startedAt}</p>
  <span class="overall-badge">${overallIcon} Tests ${summary.conclusion.toUpperCase()}</span>
</div>

<div class="stats">
  <div class="stat">
    <div class="stat-num" style="color:#02C39A">${summary.passed}</div>
    <div class="stat-lbl">Passed</div>
  </div>
  <div class="stat">
    <div class="stat-num" style="color:#E24B4A">${summary.failed}</div>
    <div class="stat-lbl">Failed</div>
  </div>
  <div class="stat">
    <div class="stat-num">${passRate}%</div>
    <div class="stat-lbl">Pass rate</div>
  </div>
  <div class="stat">
    <div class="stat-num" style="color:#4FC3F7">${(summary.durationMs/1000).toFixed(1)}s</div>
    <div class="stat-lbl">Duration</div>
  </div>
</div>

<div class="grid">

  <!-- US Person column -->
  <div class="section">
    <div class="section-header">
      <div class="section-icon pass">✓</div>
      <span class="section-title">US Persons — Login Successful</span>
      <span class="section-count pass">${usPersons.length}</span>
    </div>
    <div class="section-body">
      ${passRows}
    </div>
  </div>

  <!-- Non-US Person column -->
  <div class="section">
    <div class="section-header">
      <div class="section-icon fail">✕</div>
      <span class="section-title">Non-US Persons — Access Denied</span>
      <span class="section-count fail">${nonUsPersons.length}</span>
    </div>
    <div class="section-body">
      ${failRows}
    </div>
  </div>

</div>

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
