/* eslint-env node */

// eslint-disable-next-line
import * as fs from 'fs';
import * as Sentry from '@sentry/node';

Sentry.init({
  // jest project under Sentry organization (dev productivity team)
  dsn: 'https://3fe1dce93e3a4267979ebad67f3de327@sentry.io/4857230',
  tracesSampleRate: 1.0,
  environment: 'ci',
});

if (!fs.existsSync('/tmp/typescript-monitor.log')) {
  // We failed to retrieve the log file, but we dont want to impact the pipeline so just exit.
  // The absence of metrics in sentry should warn us here
  // eslint-disable-next-line
  console.warn('No diagnostics fil found in /tmp/typescript-monitor.log');
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

function parseContentsToKeyValue(
  input: string
): Record<string, {unit: string | undefined; value: number}> | null {
  try {
    return input
      .split('\n')
      .filter(n => !!n.trim())
      .reduce(
        (
          acc: Record<string, {unit: string | undefined; value: number}>,
          line: string
        ) => {
          const [k, v] = line.split(':');

          if (typeof k !== 'string' || typeof v !== 'string') {
            return acc;
          }

          const key = k.trim();
          const value = v.trim();

          if (ALLOWED_KEYS.has(key)) {
            const parsedValue = parseFloat(value);

            if (!isNaN(parsedValue)) {
              acc[key] = {
                value: parsedValue,
                unit: undefined,
              };
            }

            if (/([a-zA-Z]$)/.test(value)) {
              acc[key] = {
                value: parsedValue,
                unit: v.match(/([a-zA-Z]$)/)?.[0],
              };
            }
          }

          return acc;
        },
        {}
      );
  } catch {
    return null;
  }
}

const parsedDiagnostics = parseContentsToKeyValue(tsLogFile);

if (parsedDiagnostics === null) {
  // We failed to parse here, but we dont want to impact the pipeline so just exit.
  // The absence of metrics in sentry should warn us here
  // eslint-disable-next-line
  console.warn('Failed to parse diagnostics file');
  process.exit(0);
}

const bindTime = parsedDiagnostics['Bind time'] || {value: 0};
const checkTime = parsedDiagnostics['Check time'] || {value: 0};
const parseTime = parsedDiagnostics['Parse time'] || {value: 0};
const totalTime = parsedDiagnostics['Total time'] || {value: 0};
const memoryUsage = parsedDiagnostics['Memory used'] || {value: 0};

if (
  !bindTime.value &&
  !checkTime.value &&
  !parseTime.value &&
  !totalTime.value &&
  !memoryUsage.value
) {
  // Output may have been corrupted - we dont want to impact the pipeline so just exit.
  // eslint-disable-next-line
  console.warn('No diagnostics found in typescript-monitor.log');
  process.exit(0);
}

const transaction = Sentry.startTransaction({
  name: 'typescript.compilation',
});

transaction.setName('typescript.compile');

// @TODO: Remove ts ignore once the types are added to the SDK
// @ts-ignore-expect setMeasurements does not exist?
transaction.setMeasurements({
  'typescript.time.check': {value: checkTime.value},
  'typescript.time.bind': {value: bindTime.value},
  'typescript.time.parse': {value: parseTime.value},
  'typescript.time.total': {value: totalTime.value},
  'typescript.memory.used': {value: memoryUsage.value},
});

transaction.finish();

(async () => {
  await Sentry.flush(5000);
})();
