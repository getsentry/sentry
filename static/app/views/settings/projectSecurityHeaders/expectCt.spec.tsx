import {location} from 'fixtures/js-stubs/location.js';

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
        params={{orgId: org.slug, projectId: project.slug}}
        location={location({pathname: url})}
      />
    );

    expect(container).toSnapshot();
  });
});
