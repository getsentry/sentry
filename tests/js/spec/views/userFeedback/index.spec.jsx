import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectsStore from 'app/stores/projectsStore';
import UserFeedback from 'app/views/userFeedback';

describe('UserFeedback', function () {
  const {organization, routerContext} = initializeOrg();
  const pageLinks =
    '<https://sentry.io/api/0/organizations/sentry/user-feedback/?statsPeriod=14d&cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ' +
    '<https://sentry.io/api/0/organizations/sentry/user-feedback/?statsPeriod=14d&cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"';

  beforeEach(function () {
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
    ProjectsStore.reset();
  });

  it('renders', async function () {
    const project = TestStubs.Project({isMember: true});
    const params = {
      organization: TestStubs.Organization({
        projects: [project],
      }),
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

    ProjectsStore.loadInitialData(params.organization.projects);

    const wrapper = mountWithTheme(<UserFeedback {...params} />, routerContext);
    await tick();
    wrapper.update();

    expect(wrapper.find('CompactIssue')).toHaveLength(1);
  });

  it('renders no project message', function () {
    const params = {
      organization: TestStubs.Organization({
        projects: [],
      }),
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
