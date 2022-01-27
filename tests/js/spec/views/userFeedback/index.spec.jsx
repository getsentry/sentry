import {enforceActOnUseLegacyStoreHook, mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {act} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import UserFeedback from 'sentry/views/userFeedback';

describe('UserFeedback', function () {
  enforceActOnUseLegacyStoreHook();

  const {organization, routerContext} = initializeOrg();
  const pageLinks =
    '<https://sentry.io/api/0/organizations/sentry/user-feedback/?statsPeriod=14d&cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ' +
    '<https://sentry.io/api/0/organizations/sentry/user-feedback/?statsPeriod=14d&cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"';

  const project = TestStubs.Project({isMember: true});

  beforeEach(function () {
    act(() => ProjectsStore.loadInitialData([project]));

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/user-feedback/',
      body: [TestStubs.UserFeedback()],
      headers: {Link: pageLinks},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/environments/',
      body: TestStubs.Environments(),
    });
  });

  afterEach(function () {
    act(() => ProjectsStore.reset());
  });

  it('renders', async function () {
    const params = {
      organization: TestStubs.Organization(),
      location: {query: {}, search: ''},
      params: {
        orgId: organization.slug,
      },
    };

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project],
      headers: {Link: pageLinks},
    });

    const wrapper = mountWithTheme(<UserFeedback {...params} />, routerContext);
    await tick();
    wrapper.update();

    expect(wrapper.find('CompactIssue')).toHaveLength(1);
  });

  it('renders no project message', function () {
    act(() => ProjectsStore.loadInitialData([]));

    const params = {
      organization: TestStubs.Organization(),
      location: {query: {}, search: ''},
      params: {
        orgId: organization.slug,
      },
    };
    const wrapper = mountWithTheme(<UserFeedback {...params} />, routerContext);

    expect(wrapper.find('NoProjectMessage').exists()).toBe(true);
    expect(wrapper.find('UserFeedbackEmpty').exists()).toBe(false);
  });

  it('renders empty state', function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/user-feedback/',
      body: [],
    });

    const params = {
      organization: TestStubs.Organization({
        projects: [TestStubs.Project({isMember: true})],
      }),
      location: {query: {}, search: ''},
      params: {
        orgId: organization.slug,
      },
    };
    const wrapper = mountWithTheme(<UserFeedback {...params} />, routerContext);

    expect(wrapper.find('UserFeedbackEmpty').prop('projectIds')).toEqual([]);
  });

  it('renders empty state with project query', function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/user-feedback/',
      body: [],
    });

    const params = {
      organization: TestStubs.Organization({
        projects: [TestStubs.Project({isMember: true})],
      }),
      location: {query: {project: '112'}, search: ''},
      params: {
        orgId: organization.slug,
      },
    };
    const wrapper = mountWithTheme(<UserFeedback {...params} />, routerContext);

    expect(wrapper.find('UserFeedbackEmpty').prop('projectIds')).toEqual(['112']);
  });

  it('renders empty state with multi project query', function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/user-feedback/',
      body: [],
    });

    const params = {
      organization: TestStubs.Organization({
        projects: [TestStubs.Project({isMember: true})],
      }),
      location: {query: {project: ['112', '113']}, search: ''},
      params: {
        orgId: organization.slug,
      },
    };
    const wrapper = mountWithTheme(<UserFeedback {...params} />, routerContext);

    expect(wrapper.find('UserFeedbackEmpty').prop('projectIds')).toEqual(['112', '113']);
  });
});
