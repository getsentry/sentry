import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import localStorage from 'sentry/utils/localStorage';
import {PlatformSelector} from 'sentry/views/insights/mobile/screenload/components/platformSelector';

jest.mock('sentry/utils/localStorage');

describe('PlatformSelector', () => {
  it('renders with iOS and Android options', () => {
    render(<PlatformSelector />, {deprecatedRouterMocks: true});
    expect(screen.getByRole('radiogroup', {name: 'Filter platform'})).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Android'})).toBeChecked();
    expect(screen.getByRole('radio', {name: 'iOS'})).not.toBeChecked();
  });

  it('updates url params on click', async () => {
    const router = RouterFixture();
    render(<PlatformSelector />, {router, deprecatedRouterMocks: true});
    await userEvent.click(screen.getByRole('radio', {name: 'iOS'}));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/mock-pathname/',
      query: {
        platform: 'iOS',
        screensCursor: undefined,
      },
    });
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'mobile-performance-platform',
      'iOS'
    );
  });
});
