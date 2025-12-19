import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import RouteSource from 'sentry/components/search/sources/routeSource';
import HookStore from 'sentry/stores/hookStore';
import ProjectsStore from 'sentry/stores/projectsStore';

describe('RouteSource', () => {
  const project = ProjectFixture();

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
  });

  it('can find a route', async () => {
    const mock = jest.fn().mockReturnValue(null);

    render(<RouteSource query="password">{mock}</RouteSource>);

    await waitFor(() => {
      const calls = mock.mock.calls;
      expect(calls[calls.length - 1][0].results[0].item).toEqual({
        description: 'Change your account password and/or two factor authentication',
        path: '/settings/account/security/',
        resultType: 'route',
        sourceType: 'route',
        title: 'Security',
        to: '/settings/account/security/',
        resolvedTs: expect.anything(),
      });
    });
  });

  it('can load links via hooks', async () => {
    const mock = jest.fn().mockReturnValue(null);
    HookStore.add('settings:organization-navigation-config', () => {
      return {
        id: 'settings-usage-billing',
        name: 'Usage & Billing',
        items: [
          {
            path: '/settings/spike-protection',
            title: 'Spike Protection',
          },
        ],
      };
    });

    render(<RouteSource query="Spike">{mock}</RouteSource>);

    await waitFor(() => {
      const calls = mock.mock.calls;
      expect(calls[calls.length - 1][0].results[0].item).toEqual({
        path: '/settings/spike-protection',
        resultType: 'route',
        sourceType: 'route',
        title: 'Spike Protection',
        to: '/settings/spike-protection',
        resolvedTs: expect.anything(),
      });
    });
  });

  it('does not find any form field', async () => {
    const mock = jest.fn().mockReturnValue(null);
    const {routerProps} = initializeOrg();
    render(
      <RouteSource query="invalid" {...routerProps}>
        {mock}
      </RouteSource>
    );

    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(expect.objectContaining({results: []}))
    );
  });

  it('returns empty results when no organization context is available', async () => {
    const mock = jest.fn().mockReturnValue(null);
    // Render without organization context (like in /settings/account/)
    render(
      <RouteSource query="password">{mock}</RouteSource>,
      {organization: undefined}
    );

    await waitFor(() => {
      const calls = mock.mock.calls;
      // Should return empty results without throwing an error
      expect(calls[calls.length - 1][0].results).toEqual([]);
    });
  });
});
