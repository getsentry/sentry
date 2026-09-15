import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {localStorageWrapper} from 'sentry/utils/localStorage';
import {removeBodyTheme} from 'sentry/utils/removeBodyTheme';

import {Layout} from 'admin/views/layout';

describe('Admin Layout', () => {
  beforeEach(() => {
    localStorageWrapper.setItem('getsentryAdminTheme', 'lightTheme');
    removeBodyTheme();
    document.body.classList.add('theme-dark');
  });

  afterEach(() => {
    localStorageWrapper.removeItem('getsentryAdminTheme');
    removeBodyTheme();
  });

  it('keeps the body theme synchronized with the admin theme', async () => {
    render(<Layout />, {
      initialRouterConfig: {
        location: {pathname: '/_admin/'},
        route: '/_admin/',
      },
    });

    expect(document.body).toHaveClass('theme-light');
    expect(document.body).not.toHaveClass('theme-dark');

    await userEvent.click(screen.getByRole('button', {name: 'Dark mode'}));

    expect(document.body).toHaveClass('theme-dark');
    expect(document.body).not.toHaveClass('theme-light');
  });
});
