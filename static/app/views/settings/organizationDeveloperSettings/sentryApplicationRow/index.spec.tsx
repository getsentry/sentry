import {OrganizationFixture} from 'sentry-fixture/organization';
import {SentryAppFixture} from 'sentry-fixture/sentryApp';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SentryApplicationRow} from './index';

describe('SentryApplicationRow', () => {
  it('passes the integration name in navigation state', async () => {
    const organization = OrganizationFixture();
    const app = SentryAppFixture({status: 'internal'});
    const {router} = render(
      <SentryApplicationRow
        app={app}
        organization={organization}
        onPublishSubmission={() => {}}
        onRemoveApp={() => {}}
      />,
      {
        initialRouterConfig: {
          location: {
            pathname: `/settings/${organization.slug}/developer-settings/`,
          },
          route: '/settings/:orgId/developer-settings/',
        },
      }
    );

    await userEvent.click(screen.getByRole('link', {name: app.name}));

    expect(router.location.pathname).toBe(
      `/settings/${organization.slug}/developer-settings/${app.slug}/`
    );
    expect(router.location.state).toMatchObject({sentryAppName: app.name});
  });
});
