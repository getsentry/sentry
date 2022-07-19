/* eslint-env node */
import '@sentry/tracing';

// eslint-disable-next-line import/no-nodejs-modules
import fs from 'fs';
// eslint-disable-next-line import/no-nodejs-modules
import os from 'os';

import {BaseClient} from '@sentry/core';
import * as Sentry from '@sentry/node';
import {Envelope, EventEnvelope} from '@sentry/types';
import {addItemToEnvelope, timestampWithMs, uuid4} from '@sentry/utils';

function isEventEnvelope(envelope: Envelope): envelope is EventEnvelope {
  return !!(envelope[0] as any).event_id;
}

const traceFile = '/tmp/trace/trace.json';

/**
 * Currently, there is no interface to send a profile in the SDK. Here, we
 * monkey patch the SDK itself to attach the profile as an envelope item
 * to the transaction event and send it together.
 */

// @ts-ignore
const orgSendEnvelope = BaseClient.prototype._sendEnvelope;

// @ts-ignore
BaseClient.prototype._sendEnvelope = function (envelope) {
  if (isEventEnvelope(envelope) && fs.existsSync(traceFile)) {
    const profile = {
      type: 'profile',
      platform: 'typescript',
      profile_id: uuid4(),
      profile: JSON.parse(fs.readFileSync(traceFile, 'utf8')),
      device_locale:
        process.env.LC_ALL ||
        process.env.LC_MESSAGES ||
        process.env.LANG ||
        process.env.LANGUAGE,
      device_manufacturer: 'GitHub',
      device_model: 'GitHub Actions',
      device_os_name: os.platform(),
      device_os_version: os.release(),
      device_is_emulator: false,
      transaction_name: 'typescript.compile',
      version_code: '1',
      version_name: '0.1',
      duration_ns: `${realTime.value * 1e9}`,
      trace_id: envelope[0].trace.trace_id,
      transaction_id: envelope[0].event_id,
    };

    // @ts-ignore
    envelope = addItemToEnvelope(envelope, [{type: 'profile'}, profile]);
  }
  orgSendEnvelope.call(this, envelope);
};

Sentry.init({
  // typescript-compiler project under sentry-test organization (developer productivity team)
  dsn: 'https://ca215f623d6f456aa1d09ebc1efad79d@o19635.ingest.sentry.io/6326775',
  tracesSampleRate: 1.0,
  environment: 'ci',
  debug: true,
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
          const match = line.match(/Done in ([0-9]+(\.[0-9]*)?)s/);
          if (match) {
            // The total time from the diagnostics does not include the
            // time spent generating the trace, so we take the duration
            // of the yarn command.
            const parsedValue = parseFloat(match[1]);
            acc['Real Time'] = {
              value: parsedValue,
              unit: 's',
            };
            return acc;
          }

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

const realTime = parsedDiagnostics['Real Time'] || {value: 0};
const bindTime = parsedDiagnostics['Bind time'] || {value: 0};
const checkTime = parsedDiagnostics['Check time'] || {value: 0};
const parseTime = parsedDiagnostics['Parse time'] || {value: 0};
const totalTime = parsedDiagnostics['Total time'] || {value: 0};
const memoryUsage = parsedDiagnostics['Memory used'] || {value: 0};

if (
  !realTime.value &&
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

// set the start timestamp of the transaction to roughly when it should be
transaction.startTimestamp = timestampWithMs() - realTime.value;

transaction.setName('typescript.compile');

transaction.setMeasurement('typescript.time.check', checkTime.value, 'ms');
transaction.setMeasurement('typescript.time.bind', bindTime.value, 'ms');
transaction.setMeasurement('typescript.time.parse', parseTime.value, 'ms');
transaction.setMeasurement('typescript.time.total', totalTime.value, 'ms');
transaction.setMeasurement('typescript.memory.used', memoryUsage.value, 'ms');

transaction.setTag('branch', process.env.GITHUB_PR_REF);
transaction.setTag('commit', process.env.GITHUB_PR_SHA);
transaction.setTag('github_run_attempt', process.env.GITHUB_RUN_ATTEMPT);
transaction.setTag(
  'github_actions_run',
  `https://github.com/getsentry/sentry/actions/runs/${process.env.GITHUB_RUN_ID}`
);

transaction.finish();

(async () => {
  await Sentry.flush(5000);
})();
