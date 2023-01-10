import {initializeOrg} from 'sentry-test/initializeOrg';
import {render} from 'sentry-test/reactTestingLibrary';

import ProjectExpectCtReports from 'sentry/views/settings/projectSecurityHeaders/expectCt';

describe('ProjectExpectCtReports', function () {
  const {router, org, project} = initializeOrg();
  const url = `/projects/${org.slug}/${project.slug}/expect-ct/`;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: [],
    });
  });

  it('renders', function () {
    const {container} = render(
      <ProjectExpectCtReports
        route={{}}
        routeParams={{}}
        router={router}
        routes={router.routes}
        params={{projectId: project.slug}}
        location={TestStubs.location({pathname: url})}
        organization={org}
      />
    );

    expect(container).toSnapshot();
  });
});
