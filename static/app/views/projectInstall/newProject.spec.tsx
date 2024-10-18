import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';
import {MOCK_RESP_VERBOSE} from 'sentry-fixture/ruleConditions';

import {render} from 'sentry-test/reactTestingLibrary';

import NewProject from 'sentry/views/projectInstall/newProject';

describe('NewProjectPlatform', function () {
  const organization = OrganizationFixture();
  const integrations = [
    OrganizationIntegrationsFixture({
      name: "Moo Deng's Workspace",
      status: 'active',
    }),
  ];

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/rule-conditions/`,
      body: MOCK_RESP_VERBOSE,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/?integrationType=messaging`,
      body: integrations,
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('should render', function () {
    render(<NewProject />);
  });
});
