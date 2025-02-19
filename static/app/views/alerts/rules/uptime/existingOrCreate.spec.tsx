import {UptimeRuleFixture} from 'sentry-fixture/uptimeRule';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import ExistingOrCreate from './existingOrCreate';

describe('ExistingOrCreate', () => {
  it('redirects to create a new alert when none exist', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      body: [],
    });

    const {router} = render(<ExistingOrCreate />, {disableRouterMocks: true});
    await waitFor(() =>
      expect(router.location.pathname).toBe('/organizations/org-slug/alerts/new/uptime/')
    );
  });

  it('redirects to specific alert when one exists', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      body: [UptimeRuleFixture()],
    });

    const {router} = render(<ExistingOrCreate />, {disableRouterMocks: true});
    await waitFor(() =>
      expect(router.location.pathname).toBe(
        '/organizations/org-slug/alerts/uptime-rules/project-slug/1/'
      )
    );
  });

  it('redirects to the list when multiple eixst', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/combined-rules/',
      body: [UptimeRuleFixture({id: '1'}), UptimeRuleFixture({id: '2'})],
    });

    const {router} = render(<ExistingOrCreate />, {disableRouterMocks: true});
    await waitFor(() =>
      expect(router.location.pathname).toBe('/organizations/org-slug/alerts/rules/')
    );
    expect(router.location.query).toEqual({alertType: 'uptime'});
  });
});
