import 'sentry-test/reactTestingLibrary';
import {expectWithinModuleBudget} from 'sentry-test/moduleBudget';

describe('sentry-test/reactTestingLibrary', () => {
  it('stays within the module budget', () => {
    expectWithinModuleBudget('A spec that imports sentry-test/reactTestingLibrary', 1700);
  });
});
