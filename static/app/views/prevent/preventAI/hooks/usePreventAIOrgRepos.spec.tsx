import {renderHook} from 'sentry-test/reactTestingLibrary';

import {usePreventAIOrgRepos} from './usePreventAIOrgRepos';

describe('usePreventAIOrgRepos', () => {
  it('returns the mock orgRepos data', () => {
    const {result} = renderHook(() => usePreventAIOrgRepos());
    expect(result.current.data).toEqual({
      orgRepos: [
        {
          id: '1',
          name: 'org-1',
          provider: 'github',
          repos: [
            {
              id: '1',
              name: 'repo-1',
              fullName: 'org-1/repo-1',
              url: 'https://github.com/org-1/repo-1',
            },
          ],
        },
        {
          id: '2',
          name: 'org-2',
          provider: 'github',
          repos: [
            {
              id: '2',
              name: 'repo-2',
              fullName: 'org-2/repo-2',
              url: 'https://github.com/org-2/repo-2',
            },
            {
              id: '3',
              name: 'repo-3',
              fullName: 'org-2/repo-3',
              url: 'https://github.com/org-2/repo-3',
            },
          ],
        },
      ],
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
  });
});
