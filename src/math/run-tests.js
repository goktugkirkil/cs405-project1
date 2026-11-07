// `npm test` — run the maths tests in the terminal.
import { runAll } from './tests.js';

const r = runAll();
const icon = { pass: '\x1b[32m✓\x1b[0m', fail: '\x1b[31m✗\x1b[0m', todo: '\x1b[90m·\x1b[0m' };
for (const t of r.results) console.log(`${icon[t.status]} [${t.part}] ${t.name}${t.msg ? `  — ${t.msg}` : ''}`);
console.log(`\n${r.passed} passed, ${r.failed} failed, ${r.todo} not written yet`);
process.exitCode = r.failed + r.todo ? 1 : 0;
