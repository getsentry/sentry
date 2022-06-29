// Benchmarks allow us to make changes and evaluate performance before the code gets shipped to production.
// They can be used to make performance improvements or to test impact of newly added functionality.

// Run with: yarn run ts-node --project ./config/tsconfig.benchmark.json -r tsconfig-paths/register static/app/utils/profiling/profile/profile.benchmark.ts

import benchmarkjs from 'benchmark';

import {initializeLocale} from 'sentry/bootstrap/initializeLocale';

import eventedTrace from './formats/android/trace.json';
import sampledTrace from './formats/ios/trace.json';
import jsSelfProfileTrace from './formats/jsSelfProfile/trace.json';
import typescriptTrace from './formats/typescript/trace.json';
import {importProfile} from './importProfile';

// This logs an error which is annoying to see in the outputs
initializeLocale({} as any);

// We dont compare benchmark results, as we are testing a single version of the code, so we run this as a baseline,
// store the results somewhere locally and then compare the results with the new version of our code.
function benchmark(name: string, callback: () => void) {
  const suite = new benchmarkjs.Suite();

  suite
    .add(name, callback)
    .on('cycle', event => {
      // well, we need to see the results somewhere
      // eslint-disable-next-line
      console.log(event.target.toString());
    })
    .on('error', event => {
      // If something goes wrong, fail early
      throw event;
    });

  suite.run({async: true});
}

benchmark('typescript', () => importProfile(typescriptTrace as any, ''));
benchmark('js self profile', () => importProfile(jsSelfProfileTrace as any, ''));
benchmark('evented profile', () => importProfile(eventedTrace as any, ''));
benchmark('sampled profile', () => importProfile(sampledTrace as any, ''));
