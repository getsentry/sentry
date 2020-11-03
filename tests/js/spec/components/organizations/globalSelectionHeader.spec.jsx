import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mockRouterPush} from 'sentry-test/mockRouterPush';
import {mountWithTheme} from 'sentry-test/enzyme';

import ConfigStore from 'app/stores/configStore';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import GlobalSelectionStore from 'app/stores/globalSelectionStore';
import OrganizationActions from 'app/actions/organizationActions';
import ProjectsStore from 'app/stores/projectsStore';
import * as globalActions from 'app/actionCreators/globalSelection';
import {getItem} from 'app/utils/localStorage';

const changeQuery = (routerContext, query) => ({
  ...routerContext,
  context: {
    ...routerContext.context,
    router: {
      ...routerContext.context.router,
      location: {
        query,
      },
    },
  },
});

jest.mock('app/utils/localStorage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('GlobalSelectionHeader', function () {
  const {organization, router, routerContext} = initializeOrg({
    organization: {features: ['global-views']},
    projects: [
      {
        id: 2,
        slug: 'project-2',
      },
      {
        id: 3,
        slug: 'project-3',
        environments: ['prod', 'staging'],
      },
    ],
    router: {
      location: {query: {}},
      params: {orgId: 'org-slug'},
    },
  });

  beforeAll(function () {
    jest.spyOn(globalActions, 'updateDateTime');
    jest.spyOn(globalActions, 'updateEnvironments');
    jest.spyOn(globalActions, 'updateProjects');
    jest.spyOn(globalActions, 'updateParams');
    jest.spyOn(globalActions, 'updateParamsWithoutHistory');
  });

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    jest.spyOn(ProjectsStore, 'getState').mockImplementation(() => ({
      projects: organization.projects,
      loading: false,
    }));

    getItem.mockImplementation(() => null);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
  });

  afterEach(function () {
    [
      globalActions.updateDateTime,
      globalActions.updateProjects,
      globalActions.updateEnvironments,
      globalActions.updateParams,
      globalActions.updateParamsWithoutHistory,
      router.push,
      router.replace,
      getItem,
    ].forEach(mock => mock.mockClear());
    GlobalSelectionStore.reset();
  });

  it('does not update router if there is custom routing', function () {
    mountWithTheme(
      <GlobalSelectionHeader organization={organization} hasCustomRouting />,
      routerContext
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it('does not update router if org in URL params is different than org in context/props', function () {
    mountWithTheme(
      <GlobalSelectionHeader organization={organization} hasCustomRouting />,
      {
        ...routerContext,
        context: {
          ...routerContext.context,
          router: {...routerContext.context.router, params: {orgId: 'diff-org'}},
        },
      }
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it('does not replace URL with values from store when mounted with no query params', function () {
    mountWithTheme(<GlobalSelectionHeader organization={organization} />, routerContext);

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('only updates GlobalSelection store when mounted with query params', async function () {
    mountWithTheme(
      <GlobalSelectionHeader
        organization={organization}
        params={{orgId: organization.slug}}
      />,
      changeQuery(routerContext, {
        statsPeriod: '7d',
      })
    );

    expect(router.push).not.toHaveBeenCalled();

    await tick();

    expect(GlobalSelectionStore.get().selection).toEqual({
      datetime: {
        period: '7d',
        utc: null,
        start: null,
        end: null,
      },
      environments: [],
      projects: [],
    });
  });

  it('updates environments when switching projects', async function () {
    const wrapper = mountWithTheme(
      <GlobalSelectionHeader
        organization={organization}
        projects={organization.projects}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    mockRouterPush(wrapper, router);

    // Open dropdown and select both projects
    wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');
    wrapper.find('MultipleProjectSelector CheckboxFancy').at(0).simulate('click');
    wrapper.find('MultipleProjectSelector CheckboxFancy').at(1).simulate('click');
    wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');

    await tick();
    wrapper.update();
    expect(wrapper.find('MultipleProjectSelector Content').text()).toBe(
      'project-2, project-3'
    );

    // Select environment
    wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
    wrapper.find('MultipleEnvironmentSelector CheckboxFancy').at(1).simulate('click');
    wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
    await tick();

    expect(wrapper.find('MultipleEnvironmentSelector Content').text()).toBe('staging');

    expect(GlobalSelectionStore.get().selection).toEqual({
      datetime: {
        period: '14d',
        utc: null,
        start: null,
        end: null,
      },
      environments: ['staging'],
      projects: [2, 3],
    });
    const query = wrapper.prop('location').query;
    expect(query).toEqual({
      environment: 'staging',
      project: ['2', '3'],
    });

    // Now change projects, first project has no environments
    wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');
    wrapper.find('MultipleProjectSelector CheckboxFancy').at(1).simulate('click');

    wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');

    await tick();
    wrapper.update();

    // Store should not have any environments selected
    expect(GlobalSelectionStore.get().selection).toEqual({
      datetime: {
        period: '14d',
        utc: null,
        start: null,
        end: null,
      },
      environments: [],
      projects: [2],
    });
    expect(wrapper.find('MultipleEnvironmentSelector Content').text()).toBe(
      'All Environments'
    );
  });

  it('shows environments for non-member projects', async function () {
    const initialData = initializeOrg({
      organization: {features: ['global-views']},
      projects: [
        {id: 1, slug: 'staging-project', environments: ['staging'], isMember: false},
        {id: 2, slug: 'prod-project', environments: ['prod']},
      ],
      router: {
        location: {query: {project: [1]}},
        params: {orgId: 'org-slug'},
      },
    });
    jest.spyOn(ProjectsStore, 'getState').mockImplementation(() => ({
      projects: initialData.projects,
      loading: false,
    }));

    const wrapper = mountWithTheme(
      <GlobalSelectionHeader
        router={initialData.router}
        organization={initialData.organization}
        projects={initialData.projects}
      />,
      changeQuery(initialData.routerContext, {project: 1})
    );
    await tick();
    wrapper.update();

    // Open environment picker
    wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
    const checkboxes = wrapper.find('MultipleEnvironmentSelector AutoCompleteItem');

    expect(checkboxes).toHaveLength(1);
    expect(checkboxes.text()).toBe('staging');
  });

  it('updates GlobalSelection store with default period', async function () {
    mountWithTheme(
      <GlobalSelectionHeader organization={organization} />,
      changeQuery(routerContext, {
        environment: 'prod',
      })
    );

    await tick();

    expect(GlobalSelectionStore.get()).toEqual({
      isReady: true,
      selection: {
        datetime: {
          period: '14d',
          utc: null,
          start: null,
          end: null,
        },
        environments: ['prod'],
        projects: [],
      },
    });
    // Not called because of the default date
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('updates GlobalSelection store with empty dates in URL', async function () {
    mountWithTheme(
      <GlobalSelectionHeader organization={organization} />,
      changeQuery(routerContext, {
        statsPeriod: null,
      })
    );

    await tick();

    expect(GlobalSelectionStore.get()).toEqual({
      isReady: true,
      selection: {
        datetime: {
          period: '14d',
          utc: null,
          start: null,
          end: null,
        },
        environments: [],
        projects: [],
      },
    });
  });

  it('resets start&end if showAbsolute prop is false', async function () {
    mountWithTheme(
      <GlobalSelectionHeader organization={organization} showAbsolute={false} />,
      changeQuery(routerContext, {
        start: '2020-05-05T07:26:53.000',
        end: '2020-05-05T09:19:12.000',
      })
    );

    await tick();

    expect(GlobalSelectionStore.get()).toEqual({
      isReady: true,
      selection: {
        datetime: {
          period: '14d',
          utc: null,
          start: null,
          end: null,
        },
        environments: [],
        projects: [],
      },
    });
  });

  /**
   * I don't think this test is really applicable anymore
   */
  it('does not update store if url params have not changed', async function () {
    const wrapper = mountWithTheme(
      <GlobalSelectionHeader organization={organization} />,
      changeQuery(routerContext, {
        statsPeriod: '7d',
      })
    );

    [
      globalActions.updateDateTime,
      globalActions.updateProjects,
      globalActions.updateEnvironments,
    ].forEach(mock => mock.mockClear());

    wrapper.setContext(
      changeQuery(routerContext, {
        statsPeriod: '7d',
      }).context
    );

    await tick();
    wrapper.update();

    expect(globalActions.updateDateTime).not.toHaveBeenCalled();
    expect(globalActions.updateProjects).not.toHaveBeenCalled();
    expect(globalActions.updateEnvironments).not.toHaveBeenCalled();

    expect(GlobalSelectionStore.get()).toEqual({
      isReady: true,
      selection: {
        datetime: {
          period: '7d',
          utc: null,
          start: null,
          end: null,
        },
        environments: [],
        projects: [],
      },
    });
  });

  it('loads from local storage when no URL parameters', async function () {
    getItem.mockImplementation(() =>
      JSON.stringify({projects: [3], environments: ['staging']})
    );
    const initializationObj = initializeOrg({
      organization: {
        features: ['global-views'],
      },
      router: {
        params: {orgId: 'org-slug'}, // we need this to be set to make sure org in context is same as current org in URL
      },
    });

    mountWithTheme(
      <GlobalSelectionHeader organization={initializationObj.organization} />,
      initializationObj.routerContext
    );

    await tick(); // reflux tick

    expect(GlobalSelectionStore.get().selection.projects).toEqual([3]);
    // Since these are coming from URL, there should be no changes and
    // router does not need to be called
    expect(initializationObj.router.replace).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: {
          environment: ['staging'],
          project: [3],
        },
      })
    );
  });

  it('does not load from local storage when there are URL params', async function () {
    getItem.mockImplementation(() =>
      JSON.stringify({projects: [3], environments: ['staging']})
    );

    const initializationObj = initializeOrg({
      organization: {
        features: ['global-views'],
      },
      router: {
        params: {orgId: 'org-slug'}, // we need this to be set to make sure org in context is same as current org in URL
        location: {query: {project: [1, 2]}},
      },
    });

    mountWithTheme(
      <GlobalSelectionHeader organization={initializationObj.organization} />,
      initializationObj.routerContext
    );

    await tick(); // reflux tick

    expect(GlobalSelectionStore.get().selection.projects).toEqual([1, 2]);
    // Since these are coming from URL, there should be no changes and
    // router does not need to be called
    expect(initializationObj.router.replace).not.toHaveBeenCalled();
  });

  it('updates store when there are query params in URL', async function () {
    const initializationObj = initializeOrg({
      organization: {
        features: ['global-views'],
      },
      router: {
        params: {orgId: 'org-slug'}, // we need this to be set to make sure org in context is same as current org in URL
        location: {query: {project: [1, 2]}},
      },
    });

    mountWithTheme(
      <GlobalSelectionHeader organization={initializationObj.organization} />,
      initializationObj.routerContext
    );

    await tick(); // reflux tick

    expect(GlobalSelectionStore.get().selection.projects).toEqual([1, 2]);
    // Since these are coming from URL, there should be no changes and
    // router does not need to be called
    expect(initializationObj.router.replace).not.toHaveBeenCalled();
  });

  it('updates store with default values when there are no query params in URL', async function () {
    const initializationObj = initializeOrg({
      organization: {
        features: ['global-views'],
      },
      router: {
        params: {orgId: 'org-slug'}, // we need this to be set to make sure org in context is same as current org in URL
        location: {query: {}},
      },
    });

    mountWithTheme(
      <GlobalSelectionHeader organization={initializationObj.organization} />,
      initializationObj.routerContext
    );

    // Router does not update because params have not changed
    expect(initializationObj.router.replace).not.toHaveBeenCalled();
  });

  /**
   * GSH: (no global-views)
   * - mounts with no state from router
   *   - params org id === org.slug
   * - updateProjects should not be called (enforceSingleProject should not be called)
   * - componentDidUpdate with loadingProjects === true, and pass in list of projects (via projects store)
   * - enforceProject should be called and updateProjects() called with the new project
   *   - variation:
   *     - params.orgId !== org.slug (e.g. just switched orgs)
   *
   * When switching orgs when not in Issues view, the issues view gets rendered
   * with params.orgId !== org.slug
   * Global selection header gets unmounted and mounted, and in this case nothing should be done
   * until it gets updated and params.orgId === org.slug
   *
   * Separate issue:
   * IssuesList ("child view") renders before a single project is enforced, will require refactoring
   * views so that they depend on GSH enforcing a single project first IF they don't have required feature
   * (and no project id in URL).
   */
  describe('Single project selection mode', function () {
    it('does not do anything while organization is switching in single project', async function () {
      const initialData = initializeOrg({
        organization: {slug: 'old-org-slug'},
        router: {
          params: {orgId: 'org-slug'}, // we need this to be set to make sure org in context is same as current org in URL
          location: {query: {project: [1]}},
        },
      });
      ProjectsStore.getState.mockRestore();
      ProjectsStore.getAll.mockRestore();

      MockApiClient.addMockResponse({
        url: '/organizations/old-org-slug/projects/',
        body: [],
      });

      // This can happen when you switch organization so params.orgId !== the current org in context
      // In this case params.orgId = 'org-slug'
      const wrapper = mountWithTheme(
        <GlobalSelectionHeader organization={initialData.organization} />,
        initialData.routerContext
      );
      expect(globalActions.updateProjects).not.toHaveBeenCalled();

      const updatedOrganization = {
        ...organization,
        slug: 'org-slug',
        features: [],
        projects: [TestStubs.Project({id: '123', slug: 'org-slug-project1'})],
      };

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        body: updatedOrganization,
      });

      // Eventually OrganizationContext will fetch org details for `org-slug` and update `organization` prop
      // emulate fetchOrganizationDetails
      OrganizationActions.update(updatedOrganization);
      wrapper.setContext({
        organization: updatedOrganization,
        location: {query: {}},
        router: {
          ...initialData.router,
          location: {query: {}},
        },
      });
      wrapper.setProps({organization: updatedOrganization});

      ProjectsStore.loadInitialData(updatedOrganization.projects);

      expect(initialData.router.replace).toHaveBeenLastCalledWith(
        expect.objectContaining({
          query: {environment: [], project: [123]},
        })
      );
    });

    it('selects first project if more than one is requested', function () {
      const initializationObj = initializeOrg({
        router: {
          params: {orgId: 'org-slug'}, // we need this to be set to make sure org in context is same as current org in URL
          location: {query: {project: [1, 2]}},
        },
      });

      mountWithTheme(
        <GlobalSelectionHeader organization={initializationObj.organization} />,
        initializationObj.routerContext
      );

      expect(initializationObj.router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {environment: [], project: [1]},
        })
      );
    });

    it('selects first project if none (i.e. all) is requested', async function () {
      const project = TestStubs.Project({id: '3'});
      const org = TestStubs.Organization({projects: [project]});
      jest
        .spyOn(ProjectsStore, 'getState')
        .mockImplementation(() => ({projects: org.projects, loading: false}));

      const initializationObj = initializeOrg({
        organization: org,
        router: {
          params: {orgId: 'org-slug'},
          location: {query: {}},
        },
      });

      mountWithTheme(
        <GlobalSelectionHeader organization={initializationObj.organization} />,
        initializationObj.routerContext
      );

      expect(initializationObj.router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {environment: [], project: [3]},
        })
      );
    });
  });

  describe('forceProject selection mode', function () {
    let wrapper;
    beforeEach(function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: [],
      });
      const initialData = initializeOrg({
        organization: {features: ['global-views']},
        projects: [
          {id: 1, slug: 'staging-project', environments: ['staging']},
          {id: 2, slug: 'prod-project', environments: ['prod']},
        ],
        router: {
          location: {query: {}},
        },
      });
      jest.spyOn(ProjectsStore, 'getState').mockImplementation(() => ({
        projects: initialData.organization.projects,
        loadingProjects: false,
      }));

      wrapper = mountWithTheme(
        <GlobalSelectionHeader
          organization={initialData.organization}
          shouldForceProject
          forceProject={initialData.organization.projects[0]}
          showIssueStreamLink
        />,
        initialData.routerContext
      );
    });

    it('renders a back button to the forced project', function () {
      const back = wrapper.find('BackButtonWrapper');
      expect(back).toHaveLength(1);
    });

    it('renders only environments from the forced project', async function () {
      await wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
      await wrapper.update();

      const items = wrapper.find('MultipleEnvironmentSelector EnvironmentSelectorItem');
      expect(items.length).toEqual(1);
      expect(items.at(0).text()).toBe('staging');
    });
  });

  describe('without global-views (multi-project feature)', function () {
    describe('without existing URL params', function () {
      let wrapper;
      const initialData = initializeOrg({
        projects: [
          {id: 0, slug: 'random project', isMember: true},
          {id: 1, slug: 'staging-project', environments: ['staging']},
          {id: 2, slug: 'prod-project', environments: ['prod']},
        ],
        router: {
          location: {query: {}},
          params: {orgId: 'org-slug'},
        },
      });

      const createWrapper = props => {
        wrapper = mountWithTheme(
          <GlobalSelectionHeader
            params={{orgId: initialData.organization.slug}}
            organization={initialData.organization}
            {...props}
          />,
          initialData.routerContext
        );
        return wrapper;
      };

      beforeEach(function () {
        jest.spyOn(ProjectsStore, 'getState').mockImplementation(() => ({
          projects: initialData.organization.projects,
          loading: false,
        }));
        initialData.router.push.mockClear();
        initialData.router.replace.mockClear();
      });

      it('uses first project in org projects when mounting', async function () {
        createWrapper();

        await tick();
        wrapper.update();

        expect(initialData.router.replace).toHaveBeenLastCalledWith({
          pathname: undefined,
          query: {environment: [], project: [0]},
        });
      });

      it('appends projectId to URL when `forceProject` becomes available (async)', async function () {
        const mockProjectsStoreState = {
          projects: [],
          loading: true,
        };

        jest
          .spyOn(ProjectsStore, 'getState')
          .mockImplementation(() => mockProjectsStoreState);

        // forceProject generally starts undefined
        createWrapper({shouldForceProject: true});

        // load the projects
        mockProjectsStoreState.projects = initialData.organization.projects;
        mockProjectsStoreState.loading = false;

        wrapper.setProps({
          forceProject: initialData.organization.projects[1],
        });

        wrapper.update();

        expect(initialData.router.replace).toHaveBeenLastCalledWith({
          pathname: undefined,
          query: {environment: [], project: [1]},
        });

        expect(initialData.router.replace).toHaveBeenCalledTimes(1);
      });

      it('does not append projectId to URL when `forceProject` becomes available but project id already exists in URL', async function () {
        // forceProject generally starts undefined
        createWrapper({shouldForceProject: true});

        wrapper.setContext({
          router: {
            ...initialData.router,
            location: {
              ...initialData.router.location,
              query: {
                project: 321,
              },
            },
          },
        });
        wrapper.setProps({
          forceProject: initialData.organization.projects[1],
        });

        wrapper.update();

        expect(initialData.router.replace).not.toHaveBeenCalled();
      });

      it('appends projectId to URL when mounted with `forceProject`', async function () {
        // forceProject generally starts undefined
        createWrapper({
          shouldForceProject: true,
          forceProject: initialData.organization.projects[1],
        });

        wrapper.update();

        expect(initialData.router.replace).toHaveBeenLastCalledWith({
          pathname: undefined,
          query: {environment: [], project: [1]},
        });
      });
    });

    describe('with existing URL params', function () {
      let wrapper;
      const initialData = initializeOrg({
        projects: [
          {id: 0, slug: 'random project', isMember: true},
          {id: 1, slug: 'staging-project', environments: ['staging']},
          {id: 2, slug: 'prod-project', environments: ['prod']},
        ],
        router: {
          location: {query: {statsPeriod: '90d'}},
          params: {orgId: 'org-slug'},
        },
      });
      jest
        .spyOn(ProjectsStore, 'getAll')
        .mockImplementation(() => initialData.organization.projects);

      const createWrapper = props => {
        wrapper = mountWithTheme(
          <GlobalSelectionHeader
            params={{orgId: initialData.organization.slug}}
            organization={initialData.organization}
            {...props}
          />,
          initialData.routerContext
        );
        return wrapper;
      };

      beforeEach(function () {
        initialData.router.push.mockClear();
        initialData.router.replace.mockClear();
      });

      it('appends projectId to URL when mounted with `forceProject`', async function () {
        // forceProject generally starts undefined
        createWrapper({
          shouldForceProject: true,
          forceProject: initialData.organization.projects[1],
        });

        wrapper.update();

        expect(initialData.router.replace).toHaveBeenLastCalledWith({
          pathname: undefined,
          query: {environment: [], project: [1], statsPeriod: '90d'},
        });
      });
    });
  });

  describe('with global-views (multi-project feature)', function () {
    describe('without existing URL params', function () {
      let wrapper;
      const initialData = initializeOrg({
        organization: {features: ['global-views']},
        projects: [
          {id: 0, slug: 'random project', isMember: true},
          {id: 1, slug: 'staging-project', environments: ['staging']},
          {id: 2, slug: 'prod-project', environments: ['prod']},
        ],
        router: {
          location: {query: {}},
          params: {orgId: 'org-slug'},
        },
      });

      const createWrapper = (props, ctx) => {
        wrapper = mountWithTheme(
          <GlobalSelectionHeader
            params={{orgId: initialData.organization.slug}}
            organization={initialData.organization}
            {...props}
          />,
          {
            ...initialData.routerContext,
            ...ctx,
          }
        );
        return wrapper;
      };

      beforeEach(function () {
        jest.spyOn(ProjectsStore, 'getState').mockImplementation(() => ({
          projects: initialData.organization.projects,
          loading: false,
        }));
        initialData.router.push.mockClear();
        initialData.router.replace.mockClear();
      });

      it('does not use first project in org projects when mounting (and without localStorage data)', async function () {
        createWrapper();

        await tick();
        wrapper.update();

        expect(initialData.router.replace).not.toHaveBeenCalled();
      });

      it('does not append projectId to URL when `loadingProjects` changes and finishes loading', async function () {
        const mockProjectsStoreState = {
          projects: [],
          loading: true,
        };

        jest
          .spyOn(ProjectsStore, 'getState')
          .mockImplementation(() => mockProjectsStoreState);

        createWrapper();

        // load the projects
        mockProjectsStoreState.projects = initialData.organization.projects;
        mockProjectsStoreState.loading = false;

        wrapper.update();

        expect(initialData.router.replace).not.toHaveBeenCalled();
      });

      it('appends projectId to URL when `forceProject` becomes available (async)', async function () {
        const mockProjectsStoreState = {
          projects: [],
          loading: true,
        };

        jest
          .spyOn(ProjectsStore, 'getState')
          .mockImplementation(() => mockProjectsStoreState);

        // forceProject generally starts undefined
        createWrapper({shouldForceProject: true});

        await tick();

        // load the projects
        mockProjectsStoreState.projects = initialData.organization.projects;
        mockProjectsStoreState.loading = false;

        wrapper.setProps({
          forceProject: initialData.organization.projects[1],
        });

        wrapper.update();

        expect(initialData.router.replace).toHaveBeenLastCalledWith({
          pathname: undefined,
          query: {environment: [], project: [1]},
        });

        expect(initialData.router.replace).toHaveBeenCalledTimes(1);
      });

      it('does not append projectId to URL when `forceProject` becomes available but project id already exists in URL', async function () {
        // forceProject generally starts undefined
        createWrapper(
          {shouldForceProject: true},
          changeQuery(initialData.routerContext, {project: 321})
        );

        await tick();

        wrapper.setProps({
          forceProject: initialData.organization.projects[1],
        });

        wrapper.update();

        expect(initialData.router.replace).not.toHaveBeenCalled();
      });
    });
  });

  describe('projects list', function () {
    let wrapper, memberProject, nonMemberProject, initialData;
    beforeEach(function () {
      memberProject = TestStubs.Project({id: '3', isMember: true});
      nonMemberProject = TestStubs.Project({id: '4', isMember: false});
      initialData = initializeOrg({
        organization: {
          projects: [memberProject, nonMemberProject],
        },
        router: {
          location: {query: {}},
          params: {
            orgId: 'org-slug',
          },
        },
      });

      jest.spyOn(ProjectsStore, 'getState').mockImplementation(() => ({
        projects: initialData.organization.projects,
        loading: false,
      }));

      wrapper = mountWithTheme(
        <GlobalSelectionHeader organization={initialData.organization} />,
        initialData.routerContext
      );
    });

    it('gets member projects', function () {
      expect(wrapper.find('MultipleProjectSelector').prop('projects')).toEqual([
        memberProject,
      ]);
    });

    it('gets all projects if superuser', function () {
      ConfigStore.config = {
        user: {
          isSuperuser: true,
        },
      };

      wrapper = mountWithTheme(
        <GlobalSelectionHeader organization={initialData.organization} />,
        initialData.routerContext
      );

      expect(wrapper.find('MultipleProjectSelector').prop('projects')).toEqual([
        memberProject,
      ]);

      expect(wrapper.find('MultipleProjectSelector').prop('nonMemberProjects')).toEqual([
        nonMemberProject,
      ]);
    });

    it('shows "My Projects" button', async function () {
      initialData.organization.features.push('global-views');
      wrapper = mountWithTheme(
        <GlobalSelectionHeader
          organization={initialData.organization}
          projects={initialData.organization.projects}
        />,
        initialData.routerContext
      );

      await tick();
      wrapper.update();

      // open the project menu.
      wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');
      const projectSelector = wrapper.find('MultipleProjectSelector');

      // Two projects
      expect(projectSelector.find('AutoCompleteItem')).toHaveLength(2);
      // My projects in the footer
      expect(
        projectSelector.find('SelectorFooterControls Button').first().text()
      ).toEqual('View My Projects');
    });

    it('shows "All Projects" button based on features', async function () {
      initialData.organization.features.push('global-views');
      initialData.organization.features.push('open-membership');
      wrapper = mountWithTheme(
        <GlobalSelectionHeader
          organization={initialData.organization}
          projects={initialData.organization.projects}
        />,
        initialData.routerContext
      );
      await tick();
      wrapper.update();

      // open the project menu.
      wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');
      const projectSelector = wrapper.find('MultipleProjectSelector');

      // Two projects
      expect(projectSelector.find('AutoCompleteItem')).toHaveLength(2);
      // All projects in the footer
      expect(
        projectSelector.find('SelectorFooterControls Button').first().text()
      ).toEqual('View All Projects');
    });

    it('shows "All Projects" button based on role', async function () {
      initialData.organization.features.push('global-views');
      initialData.organization.role = 'owner';
      wrapper = mountWithTheme(
        <GlobalSelectionHeader
          organization={initialData.organization}
          projects={initialData.organization.projects}
        />,
        initialData.routerContext
      );

      await tick();
      wrapper.update();
      // open the project menu.
      wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');
      const projectSelector = wrapper.find('MultipleProjectSelector');

      // Two projects
      expect(projectSelector.find('AutoCompleteItem')).toHaveLength(2);
      // All projects in the footer
      expect(
        projectSelector.find('SelectorFooterControls Button').first().text()
      ).toEqual('View All Projects');
    });

    it('shows "My Projects" when "all projects" is selected', async function () {
      initialData.organization.features.push('global-views');
      initialData.organization.role = 'owner';

      wrapper = mountWithTheme(
        <GlobalSelectionHeader
          organization={initialData.organization}
          projects={initialData.organization.projects}
        />,
        changeQuery(initialData.routerContext, {project: -1})
      );

      await tick();
      wrapper.update();

      // open the project menu.
      wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');
      const projectSelector = wrapper.find('MultipleProjectSelector');

      // My projects in the footer
      expect(
        projectSelector.find('SelectorFooterControls Button').first().text()
      ).toEqual('View My Projects');
    });
  });

  describe('project icons', function () {
    const initialData = initializeOrg({
      organization: {features: ['global-views']},
      projects: [
        {id: 0, slug: 'go', platform: 'go'},
        {id: 1, slug: 'javascript', platform: 'javascript'},
        {id: 2, slug: 'other', platform: 'other'},
        {id: 3, slug: 'php', platform: 'php'},
        {id: 4, slug: 'python', platform: 'python'},
        {id: 5, slug: 'rust', platform: 'rust'},
        {id: 6, slug: 'swift', platform: 'swift'},
      ],
    });

    beforeEach(function () {
      jest.spyOn(ProjectsStore, 'getState').mockImplementation(() => ({
        projects: initialData.organization.projects,
        loading: false,
      }));
    });

    it('shows IconProject when no projects are selected', async function () {
      const wrapper = mountWithTheme(
        <GlobalSelectionHeader
          organization={initialData.organization}
          projects={initialData.organization.projects}
        />,
        changeQuery(initialData.routerContext, {project: -1})
      );

      await tick();
      wrapper.update();

      const projectSelector = wrapper.find('MultipleProjectSelector');

      expect(projectSelector.find('IconContainer svg').exists()).toBeTruthy();
      expect(projectSelector.find('PlatformIcon').exists()).toBeFalsy();

      expect(projectSelector.find('Content').text()).toEqual('All Projects');
    });

    it('shows PlatformIcon when one project is selected', async function () {
      const wrapper = mountWithTheme(
        <GlobalSelectionHeader
          organization={initialData.organization}
          projects={initialData.organization.projects}
        />,
        changeQuery(initialData.routerContext, {project: 1})
      );

      await tick();
      wrapper.update();

      const projectSelector = wrapper.find('MultipleProjectSelector');

      expect(projectSelector.find('PlatformIcon').props().platform).toEqual('javascript');

      expect(projectSelector.find('Content').text()).toEqual('javascript');
    });

    it('shows multiple PlatformIcons when multiple projects are selected, no more than 5', async function () {
      const wrapper = mountWithTheme(
        <GlobalSelectionHeader
          organization={initialData.organization}
          projects={initialData.organization.projects}
        />,
        initialData.routerContext
      );

      await tick();
      wrapper.update();

      // select 6 projects
      const headerItem = wrapper.find('MultipleProjectSelector HeaderItem');
      headerItem.simulate('click');
      wrapper
        .find('MultipleProjectSelector CheckboxFancy')
        .forEach(project => project.simulate('click'));
      headerItem.simulate('click');

      await tick();
      wrapper.update();

      // assert title and icons
      const title = wrapper.find('MultipleProjectSelector Content');
      const icons = wrapper.find('MultipleProjectSelector PlatformIcon');
      expect(title.text()).toBe('javascript, other, php, python, rust, swift');
      expect(icons.length).toBe(5);
      expect(icons.at(3).props().platform).toBe('rust');
      expect(icons.at(4).props().platform).toBe('swift');
    });
  });
});
