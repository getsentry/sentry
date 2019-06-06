import React from 'react';
import {Client} from 'app/api';
import {mount} from 'enzyme';

import {ReleaseProgress} from 'app/views/organizationReleases/list/releaseProgress';

describe('ReleaseProgress', function() {
  let wrapper, organization, project, getPromptsMock, putMock, routerContext;
  afterEach(function() {
    Client.clearMockResponses();
  });

  beforeEach(function() {
    organization = TestStubs.Organization();
    project = TestStubs.Project();
    routerContext = TestStubs.routerContext();

    getPromptsMock = Client.addMockResponse({
      method: 'GET',
      url: '/promptsactivity/',
      body: {},
    });
    putMock = Client.addMockResponse({
      method: 'PUT',
      url: '/promptsactivity/',
    });
  });

  it('does not render if steps complete', async function() {
    Client.addMockResponse({
      url: '/projects/org-slug/project-slug/releases/completion/',
      body: [
        {step: 'tag', complete: true},
        {step: 'repo', complete: true},
        {step: 'commit', complete: true},
        {step: 'deploy', complete: true},
      ],
    });
    wrapper = mount(
      <ReleaseProgress organization={organization} project={project} />,
      routerContext
    );
    expect(wrapper.state('remainingSteps')).toBe(0);
    expect(wrapper.find('ReleaseProgress')).toHaveLength(1);
    expect(wrapper.find('PanelItem')).toHaveLength(0);
  });

  it('renders with next step suggestion', async function() {
    Client.addMockResponse({
      url: '/projects/org-slug/project-slug/releases/completion/',
      body: [
        {step: 'tag', complete: true},
        {step: 'repo', complete: false},
        {step: 'commit', complete: false},
        {step: 'deploy', complete: false},
      ],
    });
    wrapper = mount(
      <ReleaseProgress organization={organization} project={project} />,
      routerContext
    );

    expect(
      wrapper
        .find('span')
        .first()
        .text()
    ).toBe('Next step: Link to a repo');
    expect(getPromptsMock).toHaveBeenCalled();
  });

  it('hides when snoozed', async function() {
    Client.addMockResponse({
      url: '/projects/org-slug/project-slug/releases/completion/',
      body: [
        {step: 'tag', complete: true},
        {step: 'repo', complete: false},
        {step: 'commit', complete: false},
        {step: 'deploy', complete: false},
      ],
    });
    wrapper = mount(
      <ReleaseProgress organization={organization} project={project} />,
      routerContext
    );
    expect(
      wrapper
        .find('span')
        .first()
        .text()
    ).toBe('Next step: Link to a repo');
    expect(wrapper.find('PanelItem')).toHaveLength(1);

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
    expect(wrapper.state('showBar')).toBe(false);
    expect(wrapper.find('ReleaseProgress')).toHaveLength(1);
    expect(wrapper.find('PanelItem')).toHaveLength(0);
  });
});
