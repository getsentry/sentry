import benchmark from 'benchmark';

import typescript from './formats/typescript/trace.json';
import {importProfile} from './importProfile';

const suite = new benchmark.Suite();
suite.add('typescript', () => {
  importProfile(typescript as any, '');
});
