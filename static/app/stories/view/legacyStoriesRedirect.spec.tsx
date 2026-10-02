import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import LegacyStoriesRedirect from 'sentry/stories/view/legacyStoriesRedirect';

describe('LegacyStoriesRedirect', () => {
  it('redirects stories deep links to scraps and preserves the query and hash', async () => {
    const {router} = render(<LegacyStoriesRedirect />, {
      initialRouterConfig: {
        location: {
          pathname: '/organizations/test-org/stories/core/button/?theme=dark#examples',
        },
      },
    });

    await waitFor(() => {
      expect(router.location.pathname).toBe(
        '/organizations/test-org/scraps/core/button/'
      );
    });
    expect(router.location.query).toEqual({theme: 'dark'});
    expect(router.location.hash).toBe('#examples');
  });

  it('does not replace an organization slug named stories', async () => {
    const {router} = render(<LegacyStoriesRedirect />, {
      initialRouterConfig: {
        location: {
          pathname: '/organizations/stories/stories/core/button/',
        },
      },
    });

    await waitFor(() => {
      expect(router.location.pathname).toBe('/organizations/stories/scraps/core/button/');
    });
  });
});
