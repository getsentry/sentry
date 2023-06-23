import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import {RouteSource} from 'sentry/components/search/sources/routeSource';
import HookStore from 'sentry/stores/hookStore';

describe('RouteSource', function () {
  it('can find a route', async function () {
    const mock = jest.fn().mockReturnValue(null);

    const {organization, project} = initializeOrg();
    render(
      <RouteSource query="password" {...{organization, project}}>
        {mock}
      </RouteSource>
    );

    await waitFor(() => {
      const calls = mock.mock.calls;
      expect(calls[calls.length - 1][0].results[0].item).toEqual({
        description: 'Change your account password and/or two factor authentication',
        path: '/settings/account/security/',
        resultType: 'route',
        sourceType: 'route',
        title: 'Security',
        to: '/settings/account/security/',
      });
    });
  });

  it('can load links via hooks', async function () {
    const mock = jest.fn().mockReturnValue(null);
    const {organization, project} = initializeOrg();
    HookStore.add('settings:organization-navigation-config', () => {
      return {
        name: 'Usage & Billing',
        items: [
          {
            path: '/settings/spike-protection',
            title: 'Spike Protection',
          },
        ],
      };
    });

    render(
      <RouteSource query="Spike" {...{organization, project}}>
        {mock}
      </RouteSource>
    );

    await waitFor(() => {
      const calls = mock.mock.calls;
      expect(calls[calls.length - 1][0].results[0].item).toEqual({
        path: '/settings/spike-protection',
        resultType: 'route',
        sourceType: 'route',
        title: 'Spike Protection',
        to: '/settings/spike-protection',
      });
    });
  });

  it('does not find any form field', function () {
    const mock = jest.fn().mockReturnValue(null);
    const {organization, project} = initializeOrg();
    render(
      <RouteSource query="invalid" {...{organization, project}}>
        {mock}
      </RouteSource>
    );

    expect(mock).toHaveBeenCalledWith(expect.objectContaining({results: []}));
  });
});
