import {getAutofixNextStep} from './getAutofixNextStep';
import type {AutofixSection} from './useExplorerAutofix';

describe('getAutofixNextStep', () => {
  const rootCause: AutofixSection = {
    step: 'root_cause',
    status: 'completed',
    artifacts: [],
    blocks: [],
  };

  it('offers a plan after a step-by-step root cause', () => {
    expect(getAutofixNextStep({sections: [rootCause]})?.action).toBe('solution');
  });

  it('offers no next step for a single run', () => {
    expect(
      getAutofixNextStep({
        sections: [rootCause],
        runState: {
          run_id: 1,
          feature_id: 'autofix_single_run',
          status: 'completed',
          updated_at: '2026-01-01T00:00:00Z',
          blocks: [],
        },
      })
    ).toBeNull();
  });
});
