import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {DropdownMenu} from '@sentry/scraps/dropdownMenu';

import {ConfigStore} from 'sentry/stores/configStore';

describe('DropdownMenu routing integration', () => {
  it('navigates to link on enter', async () => {
    const onAction = jest.fn();
    const {router} = render(
      <DropdownMenu
        items={[
          {key: 'item1', label: 'Item One', to: '/test'},
          {key: 'item2', label: 'Item Two', to: '/test2', onAction},
        ]}
        triggerLabel="Menu"
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Menu'}));
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(router.location.pathname).toBe('/test2');
    });
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('normalizes object destinations for keyboard navigation on customer domains', async () => {
    const config = ConfigStore.getState();
    ConfigStore.loadInitialData({
      ...config,
      customerDomain: {
        subdomain: 'org-slug',
        organizationUrl: 'https://org-slug.sentry.io',
        sentryUrl: 'https://sentry.io',
      },
    });
    try {
      const {router} = render(
        <DropdownMenu
          triggerLabel="Navigate"
          items={[
            {
              key: 'issues',
              label: 'Issues',
              to: {
                pathname: '/organizations/org-slug/issues/',
                query: {query: 'error'},
                hash: '#details',
              },
            },
          ]}
        />
      );
      await userEvent.click(screen.getByRole('button', {name: 'Navigate'}));
      expect(screen.getByRole('menuitemradio', {name: 'Issues'})).toHaveAttribute(
        'href',
        '/issues/?query=error#details'
      );
      await userEvent.keyboard('{Enter}');
      await waitFor(() => expect(router.location.pathname).toBe('/issues/'));
      expect(router.location.query).toEqual({query: 'error'});
      expect(router.location.hash).toBe('#details');
    } finally {
      ConfigStore.loadInitialData(config);
    }
  });
});
