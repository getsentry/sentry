import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useUpdatePreventAIFeature} from './useUpdatePreventAIFeature';

describe('useUpdatePreventAIFeature', () => {
  const orgName = 'org-1';
  const repoName = 'repo-1';

  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an object with enableFeature and isLoading properties', () => {
    const {result} = renderHook(() => useUpdatePreventAIFeature(orgName, repoName));
    expect(typeof result.current.enableFeature).toBe('function');
    expect(typeof result.current.isLoading).toBe('boolean');
  });
});
