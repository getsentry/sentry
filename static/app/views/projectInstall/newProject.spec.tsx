import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {render} from 'sentry-test/reactTestingLibrary';

import NewProject from 'sentry/views/projectInstall/newProject';

describe('NewProjectPlatform', () => {
  const organization = OrganizationFixture();
  const integrations = [
    OrganizationIntegrationsFixture({
      name: "Moo Deng's Workspace",
      status: 'active',
    }),
  ];

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: integrations,
      match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('should render', () => {
    render(<NewProject />);
  });
});
