import {run} from 'jest';

// Do this as the first thing so that any code reading it knows the right env.
process.env.NODE_ENV = 'test';
process.env.PUBLIC_URL = '';
process.env.TZ = 'America/New_York';

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  throw err;
});

let argv = process.argv.slice(2);

// Remove watch if in CI or in coverage mode
if (process.env.CI || process.env.SENTRY_PRECOMMIT || argv.includes('--coverage')) {
  argv = argv.filter(arg => arg !== '--watch');
}

// When RERUN_KNOWN_FLAKY_TESTS is set (see .github/workflows/frontend.yml),
// oversubscribe Jest workers beyond CPU count.
if (process.env.RERUN_KNOWN_FLAKY_TESTS === 'true') {
  argv = argv.filter(arg => !/^--maxWorkers=/.test(arg));
  argv.push('--maxWorkers=300%');
}

run(argv);
