import React from 'react';
import {mount} from 'enzyme';

import {ProjectCard} from 'app/views/organizationDashboard/projectCard';

describe('ProjectCard', function() {
  let wrapper, projectMock;

  beforeEach(function() {
    wrapper = mount(
      <ProjectCard
        project={TestStubs.Project({platforms: ['javascript']})}
        params={{orgId: 'org-slug'}}
        stats={[[1525042800, 1], [1525046400, 2]]}
      />,
      TestStubs.routerContext()
    );

    projectMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      data: TestStubs.Project({isBookmarked: false, platforms: ['javascript']}),
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('renders', function() {
    expect(wrapper).toMatchSnapshot();
  });

  it('can star', async function() {
    const star = wrapper.find('Star');

    expect(star.prop('active')).toBe(false);
    star.simulate('click');
    expect(projectMock).toHaveBeenCalledWith(
      '/projects/org-slug/project-slug/',
      expect.objectContaining({
        data: {
          isBookmarked: true,
        },
      })
    );
  });

  it('renders with one platform', function() {
    const platformList = wrapper.find('PlatformList');
    expect(platformList.find('StyledPlatformicon[platform="javascript"]')).toHaveLength(
      1
    );
  });

  it('renders empty state if no event has ever been sent', function() {
    wrapper = mount(
      <ProjectCard
        project={TestStubs.Project({
          platforms: [],
          firstEvent: null,
          platform: 'csharp',
        })}
        params={{orgId: 'org-slug'}}
        stats={[]}
      />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('NoEvents')).toHaveLength(1);
    const button = wrapper.find('Button');
    expect(button.prop('to')).toBe('/org-slug/project-slug/getting-started/csharp/');
  });
});
