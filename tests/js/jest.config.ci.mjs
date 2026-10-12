import {createJestConfig} from './createJestConfig.ts';

// Keep application, test-support, and lint suites together for CI sharding.
export default createJestConfig();
