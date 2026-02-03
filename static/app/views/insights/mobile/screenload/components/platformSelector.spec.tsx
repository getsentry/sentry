import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import localStorage from 'sentry/utils/localStorage';
import {PlatformSelector} from 'sentry/views/insights/mobile/screenload/components/platformSelector';
import {MobileCursors} from 'sentry/views/insights/mobile/screenload/constants';

jest.mock('sentry/utils/localStorage');

describe('PlatformSelector', () => {
  const initialRouterConfig = {
    location: {
      pathname: '/organizations/org-slug/insights/mobile/screen-loads/',
      query: {},
    },
    route: `/organizations/:orgId/insights/mobile/screen-loads/`,
  };

  it('renders with iOS and Android options', () => {
    render(<PlatformSelector />, {
      initialRouterConfig,
    });
    expect(screen.getByRole('radiogroup', {name: 'Filter platform'})).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Android'})).toBeChecked();
    expect(screen.getByRole('radio', {name: 'iOS'})).not.toBeChecked();
  });

  it('updates url params on click', async () => {
    const {router} = render(<PlatformSelector />, {
      initialRouterConfig,
    });
    await userEvent.click(screen.getByRole('radio', {name: 'iOS'}));

    await waitFor(() => {
      expect(router.location.query.platform).toBe('iOS');
    });
    expect(router.location.query[MobileCursors.SCREENS_TABLE]).toBeUndefined();
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'mobile-performance-platform',
      'iOS'
    );
  });
});
