import selectEvent from 'react-select-event';
import pick from 'lodash/pick';
import {Organization} from 'sentry-fixture/organization';
import {VercelProvider} from 'sentry-fixture/vercelIntegration';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import IntegrationOrganizationLink from 'sentry/views/integrationOrganizationLink';

describe('IntegrationOrganizationLink', () => {
  it('selecting org from dropdown loads the org through the API', async () => {
    const {routerProps} = initializeOrg();

    const org1 = Organization({
      slug: 'org1',
      name: 'Organization 1',
    });

    const org2 = Organization({
      slug: 'org2',
      name: 'Organization 2',
    });

    const org1Lite = pick(org1, ['slug', 'name', 'id']);
    const org2Lite = pick(org2, ['slug', 'name', 'id']);

    const getOrgsMock = MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [org1Lite, org2Lite],
    });

    const getOrgMock = MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/`,
      body: org2,
    });

    const getProviderMock = MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/config/integrations/?provider_key=vercel`,
      body: {providers: [VercelProvider()]},
    });

    render(
      <IntegrationOrganizationLink
        {...routerProps}
        params={{integrationSlug: 'vercel'}}
      />
    );

    expect(getOrgsMock).toHaveBeenCalled();
    expect(getOrgMock).not.toHaveBeenCalled();

    // Select organization
    await selectEvent.select(screen.getByRole('textbox'), org2.name);

    expect(screen.getByRole('button', {name: 'Install Vercel'})).toBeEnabled();

    expect(getProviderMock).toHaveBeenCalled();
    expect(getOrgMock).toHaveBeenCalled();
  });
});
