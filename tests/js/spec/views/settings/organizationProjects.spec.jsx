import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'sentry/api';
import OrganizationProjectsContainer from 'sentry/views/settings/organizationProjects';

describe('OrganizationProjects', function () {
  let org;
  let project;
  let projectsGetMock;
  let statsGetMock;
  let projectsPutMock;
  const routerContext = TestStubs.routerContext();

  beforeEach(function () {
    project = TestStubs.Project();
    org = TestStubs.Organization();

    projectsGetMock = Client.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project],
    });

    statsGetMock = Client.addMockResponse({
      url: '/organizations/org-slug/stats/',
      body: [[[], 1]],
    });

    projectsPutMock = Client.addMockResponse({
      method: 'PUT',
      url: '/projects/org-slug/project-slug/',
    });
  });

  afterEach(function () {
    Client.clearMockResponses();
  });

  it('should render the projects in the store', function () {
    const wrapper = mountWithTheme(
      <OrganizationProjectsContainer params={{orgId: org.slug}} location={{query: {}}} />
    );
    expect(wrapper).toSnapshot();

    expect(wrapper.find('ProjectBadge').text()).toBe('project-slug');

    expect(projectsGetMock).toHaveBeenCalledTimes(1);

    expect(statsGetMock).toHaveBeenCalledTimes(1);

    expect(projectsPutMock).toHaveBeenCalledTimes(0);

    wrapper.find('BookmarkStar').simulate('click');
    expect(wrapper.find('Star').prop('isBookmarked')).toBeTruthy();
    expect(projectsPutMock).toHaveBeenCalledTimes(1);
  });

  it('should search organization projects', async function () {
    const searchMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [],
    });
    const wrapper = mountWithTheme(
      <OrganizationProjectsContainer location={{query: {}}} params={{orgId: org.slug}} />,
      routerContext
    );

    wrapper
      .find('AsyncComponentSearchInput Input')
      .simulate('change', {target: {value: `${project.slug}`}});

    expect(searchMock).toHaveBeenLastCalledWith(
      `/organizations/${org.slug}/projects/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          query: project.slug,
        },
      })
    );

    wrapper.find('SearchWrapper form').simulate('submit');
    expect(routerContext.context.router.push).toHaveBeenCalledTimes(1);
  });
});
