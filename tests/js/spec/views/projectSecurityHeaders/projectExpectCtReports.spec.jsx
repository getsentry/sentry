import React from 'react';

import {shallow} from 'enzyme';
import ProjectExpectCtReports from 'app/views/settings/projectSecurityHeaders/expectCt';

describe('ProjectExpectCtReports', function() {
  let org = TestStubs.Organization();
  let project = TestStubs.Project();
  let url = `/projects/${org.slug}/${project.slug}/expect-ct/`;

  beforeEach(function() {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: [],
    });
  });

  it('renders', function() {
    let wrapper = shallow(
      <ProjectExpectCtReports
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
