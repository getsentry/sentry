import React from 'react';
import {mount} from 'enzyme';

import {ProjectCard} from 'app/views/organizationDashboard/projectCard';

// NOTE: Unmocking debounce so that the actionCreator never fires
jest.unmock('lodash/debounce');

describe('ProjectCard', function() {
  let wrapper, projectMock;

  beforeEach(function() {
    wrapper = mount(
      <ProjectCard
        project={TestStubs.Project({
          stats: [[1525042800, 1], [1525046400, 2]],
          platform: 'javascript',
        })}
        params={{orgId: 'org-slug'}}
      />,
      TestStubs.routerContext()
    );

    projectMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'PUT',
      data: TestStubs.Project({isBookmarked: false, platform: 'javascript'}),
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

  it('renders latest 2 deploys', function() {
    const latestDeploys = [
      {
        environment: 'beta',
        dateFinished: '2018-05-10T20:56:40.092Z',
        version: '123456',
      },
      {
        environment: 'staging',
        dateFinished: '2018-05-08T20:56:40.092Z',
        version: '789789',
      },
      {
        environment: 'production',
        dateFinished: '2018-05-09T20:56:40.092Z',
        version: '123123',
      },
    ];

    wrapper = mount(
      <ProjectCard
        project={TestStubs.Project({
          stats: [[1525042800, 1], [1525046400, 2]],
          platform: 'javascript',
          latestDeploys,
        })}
        params={{orgId: 'org-slug'}}
      />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('Deploy')).toHaveLength(2);
    expect(wrapper.find('NoDeploys')).toHaveLength(0);
    expect(wrapper.find('Environment[children="beta"]')).toHaveLength(1);
    expect(wrapper.find('Environment[children="production"]')).toHaveLength(1);
    expect(wrapper.find('Environment[children="staging"]')).toHaveLength(0);
  });

  it('renders empty state if no deploys', function() {
    expect(wrapper.find('NoDeploys')).toHaveLength(1);
  });

  it('renders with platform', function() {
    expect(wrapper.find('Platformicon[platform="javascript"]')).toHaveLength(1);
  });

  it('renders loading placeholder card if there are no stats', function() {
    wrapper = mount(
      <ProjectCard project={TestStubs.Project()} params={{orgId: 'org-slug'}} />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('LoadingCard')).toHaveLength(1);
  });
});
