import React from 'react';
import {Client} from 'app/api';
import {mount} from 'enzyme';

import ReleaseProgress from 'app/views/projectReleases/releaseProgress';

describe('ReleaseProgress', function() {
  let wrapper, organization, project, getPromptsMock, putMock, routerContext;
  afterEach(function() {
    Client.clearMockResponses();
  });

  beforeEach(function() {
    organization = TestStubs.Organization();
    project = TestStubs.Project();
    routerContext = TestStubs.routerContext([
      {
        organization,
        project,
      },
    ]);

    getPromptsMock = Client.addMockResponse({
      method: 'GET',
      url: '/promptsactivity/',
      body: {},
    });
    putMock = Client.addMockResponse({
      method: 'PUT',
      url: '/promptsactivity/',
    });
    Client.addMockResponse({
      url: '/projects/org-slug/project-slug/releases/completion/',
      body: [
        {step: 'tag', complete: true},
        {step: 'repo', complete: false},
        {step: 'commit', complete: false},
        {step: 'deploy', complete: false},
      ],
    });
  });

  it('renders with three steps', async function() {
    wrapper = mount(
      <ReleaseProgress orgId={organization.id} projectId={project.id} />,
      routerContext
    );
    expect(getPromptsMock).toHaveBeenCalled();
    expect(wrapper.find('li')).toHaveLength(3);
  });

  it('hides when snoozed', async function() {
    wrapper = mount(
      <ReleaseProgress orgId={organization.id} projectId={project.id} />,
      routerContext
    );
    expect(getPromptsMock).toHaveBeenCalled();
    expect(wrapper.find('li')).toHaveLength(3);

    //Snooze the bar
    wrapper
      .find('[data-test-id="snoozed"]')
      .first()
      .simulate('click');

    expect(putMock).toHaveBeenCalledWith(
      '/promptsactivity/',
      expect.objectContaining({
        method: 'PUT',
        data: {
          organization_id: organization.id,
          project_id: project.id,
          feature: 'releases',
          status: 'snoozed',
        },
      })
    );
    wrapper.update();
    expect(wrapper.state('showBar')).toBe(false);
  });
});
