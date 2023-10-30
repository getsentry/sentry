// Benchmarks allow us to make changes and evaluate performance before the code gets shipped to production.
// They can be used to make performance improvements or to test impact of newly added functionality.

// Run with: yarn run ts-node --project ./config/tsconfig.benchmark.json -r tsconfig-paths/register static/app/utils/profiling/profile/profile.benchmark.ts

import benchmarkjs from 'benchmark';

import {initializeLocale} from 'sentry/bootstrap/initializeLocale';

import eventedTrace from './formats/android/trace.json';
import sampledTrace from './formats/ios/trace.json';
import jsSelfProfileTrace from './formats/jsSelfProfile/trace.json';
import nodeTrace from './formats/node/trace.json';
import typescriptTrace from './formats/typescript/trace.json';
import {importProfile} from './importProfile';

// This logs an error which is annoying to see in the outputs
initializeLocale({} as any);

// Note: You MUST import @sentry/tracing package before @sentry/profiling-node
// eslint-disable-next-line simple-import-sort/imports
import * as Sentry from '@sentry/node';
import '@sentry/tracing';
import {ProfilingIntegration} from '@sentry/profiling-node';

if (process.env.PROFILE) {
  Sentry.init({
    dsn: 'https://7fa19397baaf433f919fbe02228d5470@o1137848.ingest.sentry.io/6625302',
    integrations: [
      // Add our Profilling integration
      new ProfilingIntegration(),
    ],
    debug: true,
    tracesSampleRate: 1.0,
    // Set sampling rate for profiling
    profilesSampleRate: 1.0,
  });
}

// We dont compare benchmark results, as we are testing a single version of the code, so we run this as a baseline,
// store the results somewhere locally and then compare the results with the new version of our code.
function benchmark(name: string, callback: () => void) {
  const suite = new benchmarkjs.Suite();

  suite
    .add(name, callback, {minSamples: 50})
    .on('cycle', event => {
      // well, we need to see the results somewhere
      // eslint-disable-next-line
      console.log(event.target.toString(), (event.target.stats.mean * 1e3).toFixed(2));
    })
    .on('error', event => {
      // If something goes wrong, fail early
      throw event;
    })
    .on('fini');

  suite.run({async: true, minSamples: 100});
}

benchmark('typescript', () => importProfile(typescriptTrace as any, '', 'flamechart'));
benchmark('js self profile', () =>
  importProfile(jsSelfProfileTrace as any, '', 'flamechart')
);
benchmark('evented profile', () => importProfile(eventedTrace as any, '', 'flamechart'));
benchmark('sampled profile', () => importProfile(sampledTrace as any, '', 'flamechart'));
benchmark('sampled node profile', () =>
  importProfile(nodeTrace as any, '', 'flamechart')
);

// importProfile(nodeTrace, '', 'flamechart');
