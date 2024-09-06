import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {browserHistory} from 'sentry/utils/browserHistory';
import localStorage from 'sentry/utils/localStorage';
import {PlatformSelector} from 'sentry/views/insights/mobile/screenload/components/platformSelector';

jest.mock('sentry/utils/localStorage');

describe('PlatformSelector', function () {
  it('renders with iOS and Android options', function () {
    render(<PlatformSelector />);
    expect(screen.getByRole('radiogroup', {name: 'Filter platform'})).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Android'})).toBeChecked();
    expect(screen.getByRole('radio', {name: 'iOS'})).not.toBeChecked();
  });

  it('updates url params on click', async function () {
    render(<PlatformSelector />);
    await userEvent.click(screen.getByRole('radio', {name: 'iOS'}));

    expect(browserHistory.push).toHaveBeenCalledWith({
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
