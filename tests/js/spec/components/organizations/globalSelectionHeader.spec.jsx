import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mockRouterPush} from 'sentry-test/mockRouterPush';
import {mountWithTheme} from 'sentry-test/enzyme';
import ConfigStore from 'app/stores/configStore';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import GlobalSelectionStore from 'app/stores/globalSelectionStore';
import ProjectsStore from 'app/stores/projectsStore';
import * as globalActions from 'app/actionCreators/globalSelection';

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

jest.mock('app/utils/localStorage', () => {
  return {
    getItem: () => JSON.stringify({projects: [3], environments: ['staging']}),
    setItem: jest.fn(),
  };
});

describe('GlobalSelectionHeader', function() {
  const {organization, router, routerContext} = initializeOrg({
    organization: {features: ['global-views']},
    projects: [
      {
        id: 2,
      },
      {
        id: 3,
        slug: 'project-3',
        environments: ['prod', 'staging'],
      },
    ],
    router: {
      location: {query: {}},
    },
  });

  beforeAll(function() {
    jest.spyOn(globalActions, 'updateDateTime');
    jest.spyOn(globalActions, 'updateEnvironments');
    jest.spyOn(globalActions, 'updateProjects');
  });

  beforeEach(function() {
    jest.spyOn(ProjectsStore, 'getAll').mockImplementation(() => organization.projects);
    GlobalSelectionStore.reset();
    [
      globalActions.updateDateTime,
      globalActions.updateProjects,
      globalActions.updateEnvironments,
      router.push,
      router.replace,
    ].forEach(mock => mock.mockClear());
  });

  it('does not update router if there is custom routing', function() {
    mountWithTheme(
      <GlobalSelectionHeader organization={organization} hasCustomRouting />,
      routerContext
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it('does not update router if org in URL params is different than org in context/props', function() {
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

  it('does not replace URL with values from store when mounted with no query params', function() {
    mountWithTheme(<GlobalSelectionHeader organization={organization} />, routerContext);

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('only updates GlobalSelection store when mounted with query params', async function() {
    mountWithTheme(
      <GlobalSelectionHeader organization={organization} />,
      changeQuery(routerContext, {
        statsPeriod: '7d',
      })
    );

    expect(router.push).not.toHaveBeenCalled();
    expect(globalActions.updateDateTime).toHaveBeenCalledWith({
      period: '7d',
      utc: null,
      start: null,
      end: null,
    });
    expect(globalActions.updateProjects).toHaveBeenCalledWith([]);
    expect(globalActions.updateEnvironments).toHaveBeenCalledWith([]);

    await tick();

    expect(GlobalSelectionStore.get()).toEqual({
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

  it('updates GlobalSelection store when re-rendered with different query params', async function() {
    const wrapper = mountWithTheme(
      <GlobalSelectionHeader organization={organization} />,
      changeQuery(routerContext, {
        statsPeriod: '7d',
      })
    );

    wrapper.setContext(
      changeQuery(routerContext, {
        statsPeriod: '21d',
      }).context
    );

    await tick();
    wrapper.update();

    expect(globalActions.updateDateTime).toHaveBeenCalledWith({
      period: '21d',
      utc: null,
      start: null,
      end: null,
    });
    // These should not be called because they have not changed, only date has changed
    expect(globalActions.updateProjects).toHaveBeenCalledWith([]);
    expect(globalActions.updateEnvironments).toHaveBeenCalledWith([]);

    globalActions.updateDateTime.mockClear();
    globalActions.updateProjects.mockClear();
    globalActions.updateEnvironments.mockClear();

    expect(GlobalSelectionStore.get()).toEqual({
      datetime: {
        period: '21d',
        utc: null,
        start: null,
        end: null,
      },
      environments: [],
      projects: [],
    });
  });

  it('updates environments when switching projects', async function() {
    const wrapper = mountWithTheme(
      <GlobalSelectionHeader
        organization={organization}
        projects={organization.projects}
      />,
      routerContext
    );

    mockRouterPush(wrapper, router);

    // Open dropdown and select both projects
    wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');
    wrapper
      .find('MultipleProjectSelector CheckboxFancy')
      .at(0)
      .simulate('click');
    wrapper
      .find('MultipleProjectSelector CheckboxFancy')
      .at(1)
      .simulate('click');
    wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');

    await tick();
    wrapper.update();
    expect(wrapper.find('MultipleProjectSelector Content').text()).toBe(
      'project-slug, project-3'
    );

    // Select environment
    wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
    wrapper
      .find('MultipleEnvironmentSelector CheckboxFancy')
      .at(1)
      .simulate('click');
    wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
    await tick();

    expect(wrapper.find('MultipleEnvironmentSelector Content').text()).toBe('staging');

    expect(GlobalSelectionStore.get()).toEqual({
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
    wrapper
      .find('MultipleProjectSelector CheckboxFancy')
      .at(1)
      .simulate('click');

    wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');

    await tick();
    wrapper.update();

    // Store should not have any environments selected
    expect(GlobalSelectionStore.get()).toEqual({
      datetime: {
        period: '14d',
        utc: null,
        start: null,
        end: null,
      },
      environments: [],
      projects: [2],
    });
    expect(wrapper.prop('location').query).toEqual({project: '2'});
    expect(wrapper.find('MultipleEnvironmentSelector Content').text()).toBe(
      'All Environments'
    );
  });

  it('updates URL to match GlobalSelection store when re-rendered with `forceUrlSync` prop', async function() {
    const wrapper = mountWithTheme(
      <GlobalSelectionHeader router={router} organization={organization} />,
      routerContext
    );

    await tick();
    wrapper.update();

    // Force load, will load from mocked localStorage
    GlobalSelectionStore.loadInitialData(organization, {}, {forceUrlSync: true});

    await tick();
    wrapper.update();

    expect(router.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          environment: ['staging'],
          project: [3],
        },
      })
    );
  });

  it('updates GlobalSelection store with default period', async function() {
    mountWithTheme(
      <GlobalSelectionHeader organization={organization} />,
      changeQuery(routerContext, {
        environment: 'prod',
      })
    );

    expect(router.push).not.toHaveBeenCalled();
    expect(globalActions.updateDateTime).toHaveBeenCalledWith({
      period: '14d',
      utc: null,
      start: null,
      end: null,
    });
    expect(globalActions.updateProjects).toHaveBeenCalledWith([]);
    expect(globalActions.updateEnvironments).toHaveBeenCalledWith(['prod']);

    await tick();

    expect(GlobalSelectionStore.get()).toEqual({
      datetime: {
        period: '14d',
        utc: null,
        start: null,
        end: null,
      },
      environments: ['prod'],
      projects: [],
    });
  });

  it('updates GlobalSelection store with empty date selections', async function() {
    const wrapper = mountWithTheme(
      <GlobalSelectionHeader organization={organization} />,
      changeQuery(routerContext, {
        statsPeriod: '7d',
      })
    );

    wrapper.setContext(
      changeQuery(routerContext, {
        statsPeriod: null,
      }).context
    );
    await tick();
    wrapper.update();

    expect(globalActions.updateDateTime).toHaveBeenCalledWith({
      period: '7d',
      utc: null,
      start: null,
      end: null,
    });
    expect(globalActions.updateProjects).toHaveBeenCalledWith([]);
    expect(globalActions.updateEnvironments).toHaveBeenCalledWith([]);

    expect(GlobalSelectionStore.get()).toEqual({
      datetime: {
        period: '14d',
        utc: null,
        start: null,
        end: null,
      },
      environments: [],
      projects: [],
    });
  });

  it('does not update store if url params have not changed', async function() {
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

  it('updates store when there are query params in URL', function() {
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

    expect(globalActions.updateProjects).toHaveBeenCalledWith([1, 2]);
    expect(globalActions.updateEnvironments).toHaveBeenCalledWith([]);
    expect(globalActions.updateDateTime).toHaveBeenCalled();
  });

  it('updates store with default values when there are no query params in URL', function() {
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

    expect(globalActions.updateProjects).toHaveBeenCalledWith([]);
    expect(globalActions.updateEnvironments).toHaveBeenCalledWith([]);
    expect(globalActions.updateDateTime).toHaveBeenCalledWith({
      end: null,
      period: '14d',
      start: null,
      utc: null,
    });
  });

  describe('Single project selection mode', function() {
    it('selects first project if more than one is requested', function() {
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

      expect(globalActions.updateProjects).toHaveBeenCalledWith([1]);
    });

    it('selects first project if none (i.e. all) is requested', function() {
      const project = TestStubs.Project({id: '3'});
      const org = TestStubs.Organization({projects: [project]});
      jest.spyOn(ProjectsStore, 'getAll').mockImplementation(() => org.projects);

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

      expect(globalActions.updateProjects).toHaveBeenCalledWith([3]);
    });
  });

  describe('forceProject selection mode', function() {
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

    const wrapper = mountWithTheme(
      <GlobalSelectionHeader
        organization={initialData.organization}
        shouldForceProject
        forceProject={initialData.organization.projects[0]}
      />,
      initialData.routerContext
    );

    it('renders a back button to the forced project', function() {
      const back = wrapper.find('BackButtonWrapper');
      expect(back).toHaveLength(1);
    });

    it('renders only environments from the forced project', async function() {
      await wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
      await wrapper.update();

      const items = wrapper.find('MultipleEnvironmentSelector EnvironmentSelectorItem');
      expect(items.length).toEqual(1);
      expect(items.at(0).text()).toBe('staging');
    });
  });

  describe('without global-views (multi-project feature)', function() {
    describe('without existing URL params', function() {
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

      beforeEach(function() {
        jest
          .spyOn(ProjectsStore, 'getAll')
          .mockImplementation(() => initialData.organization.projects);
        initialData.router.push.mockClear();
        initialData.router.replace.mockClear();
      });

      it('uses first project in org projects when mounting', async function() {
        createWrapper();

        await tick();
        wrapper.update();

        expect(initialData.router.replace).toHaveBeenLastCalledWith({
          pathname: undefined,
          query: {project: [0]},
        });
      });

      it('appends projectId to URL when `forceProject` becomes available (async)', async function() {
        // forceProject generally starts undefined
        createWrapper({shouldForceProject: true});

        wrapper.setProps({
          forceProject: initialData.organization.projects[1],
        });

        wrapper.update();

        expect(initialData.router.replace).toHaveBeenLastCalledWith({
          pathname: undefined,
          query: {project: [1]},
        });
      });

      it('does not append projectId to URL when `forceProject` becomes available but project id already exists in URL', async function() {
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

      it('appends projectId to URL when mounted with `forceProject`', async function() {
        // forceProject generally starts undefined
        createWrapper({
          shouldForceProject: true,
          forceProject: initialData.organization.projects[1],
        });

        wrapper.update();

        expect(initialData.router.replace).toHaveBeenLastCalledWith({
          pathname: undefined,
          query: {project: [1]},
        });
      });
    });

    describe('with existing URL params', function() {
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

      beforeEach(function() {
        initialData.router.push.mockClear();
        initialData.router.replace.mockClear();
      });

      it('appends projectId to URL when mounted with `forceProject`', async function() {
        // forceProject generally starts undefined
        createWrapper({
          shouldForceProject: true,
          forceProject: initialData.organization.projects[1],
        });

        wrapper.update();

        expect(initialData.router.replace).toHaveBeenLastCalledWith({
          pathname: undefined,
          query: {project: [1], statsPeriod: '90d'},
        });
      });
    });
  });

  describe('projects list', function() {
    let wrapper, memberProject, nonMemberProject, initialData;
    beforeEach(function() {
      memberProject = TestStubs.Project({id: '3', isMember: true});
      nonMemberProject = TestStubs.Project({id: '4', isMember: false});
      const org = TestStubs.Organization({projects: [memberProject, nonMemberProject]});
      jest.spyOn(ProjectsStore, 'getAll').mockImplementation(() => org.projects);

      initialData = initializeOrg({
        organization: org,
        router: {
          location: {query: {}},
        },
      });

      wrapper = mountWithTheme(
        <GlobalSelectionHeader organization={initialData.organization} />,
        initialData.routerContext
      );
    });

    it('gets member projects', function() {
      expect(wrapper.find('MultipleProjectSelector').prop('projects')).toEqual([
        memberProject,
      ]);
    });

    it('gets all projects if superuser', function() {
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

    it('shows "My Projects" button', function() {
      initialData.organization.features.push('global-views');
      wrapper = mountWithTheme(
        <GlobalSelectionHeader
          organization={initialData.organization}
          projects={initialData.organization.projects}
        />,
        initialData.routerContext
      );

      // open the project menu.
      wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');
      const projectSelector = wrapper.find('MultipleProjectSelector');

      // Two projects
      expect(projectSelector.find('AutoCompleteItem')).toHaveLength(2);
      // My projects in the footer
      expect(
        projectSelector
          .find('SelectorFooterControls Button')
          .first()
          .text()
      ).toEqual('View My Projects');
    });

    it('shows "All Projects" button based on features', function() {
      initialData.organization.features.push('global-views');
      initialData.organization.features.push('open-membership');
      wrapper = mountWithTheme(
        <GlobalSelectionHeader
          organization={initialData.organization}
          projects={initialData.organization.projects}
        />,
        initialData.routerContext
      );

      // open the project menu.
      wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');
      const projectSelector = wrapper.find('MultipleProjectSelector');

      // Two projects
      expect(projectSelector.find('AutoCompleteItem')).toHaveLength(2);
      // All projects in the footer
      expect(
        projectSelector
          .find('SelectorFooterControls Button')
          .first()
          .text()
      ).toEqual('View All Projects');
    });

    it('shows "All Projects" button based on role', function() {
      initialData.organization.features.push('global-views');
      initialData.organization.role = 'owner';
      wrapper = mountWithTheme(
        <GlobalSelectionHeader
          organization={initialData.organization}
          projects={initialData.organization.projects}
        />,
        initialData.routerContext
      );

      // open the project menu.
      wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');
      const projectSelector = wrapper.find('MultipleProjectSelector');

      // Two projects
      expect(projectSelector.find('AutoCompleteItem')).toHaveLength(2);
      // All projects in the footer
      expect(
        projectSelector
          .find('SelectorFooterControls Button')
          .first()
          .text()
      ).toEqual('View All Projects');
    });

    it('shows "My Projects" when "all projects" is selected', async function() {
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

      // open the project menu.
      wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');
      const projectSelector = wrapper.find('MultipleProjectSelector');

      // My projects in the footer
      expect(
        projectSelector
          .find('SelectorFooterControls Button')
          .first()
          .text()
      ).toEqual('View My Projects');
    });
  });
});
