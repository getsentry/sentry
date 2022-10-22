import {location} from 'fixtures/js-stubs/location';
import {Organization} from 'fixtures/js-stubs/organization';
import {Project} from 'fixtures/js-stubs/project';
import {routerProps} from 'fixtures/js-stubs/routerProps';

import {render} from 'sentry-test/reactTestingLibrary';

import ProjectHpkpReports from 'sentry/views/settings/projectSecurityHeaders/hpkp';

describe('ProjectHpkpReports', function () {
  const org = Organization();
  const project = Project();
  const url = `/projects/${org.slug}/${project.slug}/hpkp/`;

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
      <ProjectHpkpReports
        organization={org}
        project={project}
        {...routerProps({
          params: {orgId: org.slug, projectId: project.slug},
          location: location({pathname: url}),
        })}
      />
    );
    expect(container).toSnapshot();
  });
});
