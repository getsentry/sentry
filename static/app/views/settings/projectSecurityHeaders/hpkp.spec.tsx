import {initializeOrg} from 'sentry-test/initializeOrg';
import {render} from 'sentry-test/reactTestingLibrary';

import ProjectHpkpReports from 'sentry/views/settings/projectSecurityHeaders/hpkp';

describe('ProjectHpkpReports', function () {
  const {organization: org, project, routerProps} = initializeOrg();

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: [],
    });
  });

  it('renders', function () {
    const {container} = render(
      <ProjectHpkpReports {...routerProps} organization={org} />
    );
    expect(container).toSnapshot();
  });
});
