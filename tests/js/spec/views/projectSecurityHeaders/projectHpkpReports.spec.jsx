import React from 'react';

import {shallow} from 'enzyme';
import ProjectHpkpReports from 'app/views/settings/projectSecurityHeaders/hpkp';

describe('ProjectHpkpReports', function() {
  let org = TestStubs.Organization();
  let project = TestStubs.Project();
  let url = `/projects/${org.slug}/${project.slug}/hpkp/`;

  beforeEach(function() {
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

  it('renders', function() {
    let wrapper = shallow(
      <ProjectHpkpReports
        organization={org}
        project={project}
        setProjectNavSection={() => {}}
        {...TestStubs.routerProps({
          params: {orgId: org.slug, projectId: project.slug},
          location: TestStubs.location({pathname: url}),
        })}
      />,
      TestStubs.routerContext()
    );
    expect(wrapper).toMatchSnapshot();
  });
});
