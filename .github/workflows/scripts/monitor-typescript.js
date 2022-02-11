/* eslint-env node */

// eslint-disable-next-line
const fs = require('fs');
// eslint-disable-next-line
const crypto = require('crypto');

const Sentry = require('@sentry/node');

Sentry.init({
  dsn: '',
  tracesSampleRate: 1.0,
});

if (!fs.existsSync('/tmp/typescript-monitor.log')) {
  // We failed to retrieve the log file, but we dont want to impact the pipeline so just exit.
  // The absence of metrics in sentry should warn us here
  process.exit(0);
}

const ALLOWED_KEYS = new Set([
  'Files',
  'Lines',
  'Nodes',
  'Identifiers',
  'Symbols',
  'Types',
  'Instantiations',
  'Memory used',
  'I/O Read',
  'I/O Write',
  'Parse time',
  'Bind time',
  'Check time',
  'Emit time',
  'Total time',
]);

const tsLogFile = fs.readFileSync('/tmp/typescript-monitor.log', 'utf8');

function toKeyValue(input) {
  try {
    return input
      .split('\n')
      .filter(n => !!n)
      .reduce((acc, line) => {
        const [k, v] = line.split(':');

        if (typeof k !== 'string' || typeof v !== 'string') {
          return acc;
        }

        const key = k.trim();
        const value = v.trim();

        if (ALLOWED_KEYS.has(key)) {
          let number = parseFloat(value);
          let unit = undefined;

          if (!isNaN(number)) {
            acc[key] = {value: number, unit};
          }

          if (/([a-zA-Z]$)/.test(value)) {
            number = parseFloat(v.substring(0, v.length - 2));
            unit = v.match(/([a-zA-Z]$)/)?.[0];
            acc[key] = {value: number, unit};
          }
        }

        return acc;
      }, {});
  } catch (e) {
    return null;
  }
}

const parsedDiagnostics = toKeyValue(tsLogFile);

if (parsedDiagnostics === null) {
  // We failed to parse here, but we dont want to impact the pipeline so just exit.
  // The absence of metrics in sentry should warn us here
  process.exit(0);
}

const bindTime = parsedDiagnostics['Bind time'];
const checkTime = parsedDiagnostics['Check time'];
const parseTime = parsedDiagnostics['Parse time'];
const totalTime = parsedDiagnostics['Total time'];
const memoryUsage = parsedDiagnostics['Memory used'];

const now = new Date().getTime() / 1000;

const totalTimeTransaction = {
  event_id: crypto.randomBytes(16).toString('hex'),
  environment: 'local',
  timestamp: now,
  start_timestamp: now - totalTime.value * 1000,
  measurements: {
    'time.check': {value: checkTime.value},
    'time.bind': {value: bindTime.value},
    'time.parse': {value: parseTime.value},
    'time.total': {value: totalTime.value},
    memory: {value: memoryUsage.value},
  },
  name: 'typescript.compilation',
  transaction: 'typescript.compilation',
  type: 'transaction',
};

Sentry.captureEvent(totalTimeTransaction);

(async () => {
  await Sentry.flush(5000);
})();
