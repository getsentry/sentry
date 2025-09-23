import {renderHook} from 'sentry-test/reactTestingLibrary';

import localStorageWrapper from 'sentry/utils/localStorage';

import {usePreventAIConfig} from './usePreventAIConfig';

describe('usePreventAIConfig', () => {
  const orgName = 'test-org';
  const repoName = 'test-repo';

  beforeEach(() => {
    localStorageWrapper.clear();
  });

  it('returns default config when nothing is in localStorage', () => {
    const {result} = renderHook(() => usePreventAIConfig(orgName, repoName));
    expect(result.current.data).toEqual({
      features: {
        vanilla: {enabled: false},
        test_generation: {enabled: false},
        bug_prediction: {
          enabled: false,
          triggers: {
            on_command_phrase: false,
            on_ready_for_review: false,
            on_new_commit: false,
          },
        },
      },
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
  });
});
