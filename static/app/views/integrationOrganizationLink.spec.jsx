import selectEvent from 'react-select-event';
import pick from 'lodash/pick';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import IntegrationOrganizationLink from 'sentry/views/integrationOrganizationLink';

describe('IntegrationOrganizationLink', () => {
  let getOrgsMock, getOrgMock, getProviderMock, org1, org1Lite, org2, org2Lite;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    org1 = TestStubs.Organization({
      slug: 'org1',
      name: 'Organization 1',
    });

    org2 = TestStubs.Organization({
      slug: 'org2',
      name: 'Organization 2',
    });

    org1Lite = pick(org1, ['slug', 'name', 'id']);
    org2Lite = pick(org2, ['slug', 'name', 'id']);

    getOrgsMock = MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [org1Lite, org2Lite],
    });
  });

  it('selecting org from dropdown loads the org through the API', async () => {
    getOrgMock = MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/`,
      body: org2,
    });

    getProviderMock = MockApiClient.addMockResponse({
      url: `/organizations/${org2.slug}/config/integrations/?provider_key=vercel`,
      body: {providers: [TestStubs.VercelProvider()]},
    });

    render(<IntegrationOrganizationLink params={{integrationSlug: 'vercel'}} />);

    expect(getOrgsMock).toHaveBeenCalled();
    expect(getOrgMock).not.toHaveBeenCalled();

    // Select organization
    await selectEvent.select(screen.getByRole('textbox'), org2.name);

    expect(screen.getByRole('button', {name: 'Install Vercel'})).toBeEnabled();

    expect(getProviderMock).toHaveBeenCalled();
    expect(getOrgMock).toHaveBeenCalled();
  });
});
