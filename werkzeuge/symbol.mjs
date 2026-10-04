import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const html = (s) => `<html><body style="margin:0"><div id="i" style="width:${s}px;height:${s}px;position:relative;overflow:hidden;
background:linear-gradient(140deg,#3fb0ff 0%,#0a64c8 52%,#5b4fd8 100%)">
<div style="position:absolute;width:${s*.55}px;height:${s*.55}px;border-radius:50%;left:${-s*.12}px;top:${-s*.16}px;background:rgba(255,255,255,.14)"></div>
<div style="position:absolute;width:${s*.22}px;height:${s*.22}px;border-radius:50%;right:${s*.14}px;bottom:${s*.12}px;background:rgba(255,211,77,.9)"></div>
<svg viewBox="0 0 24 24" style="position:absolute;left:${s*.2}px;top:${s*.2}px;width:${s*.6}px;height:${s*.6}px" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="rgba(255,255,255,.12)"/><path d="M8 13l3 3 5-5"/></svg></div></body></html>`;
for (const [s, name] of [[180, 'app/icons/icon-180.png'], [192, 'app/icons/icon-192.png'], [512, 'app/icons/icon-512.png']]) {
  const p = await b.newPage({ viewport: { width: s, height: s } });
  await p.setContent(html(s));
  await p.locator('#i').screenshot({ path: name });
}
await b.close();
