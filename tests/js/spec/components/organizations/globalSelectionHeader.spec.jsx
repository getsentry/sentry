import React from 'react';

import {initializeOrg} from 'app-test/helpers/initializeOrg';
import {mount} from 'enzyme';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import GlobalSelectionStore from 'app/stores/globalSelectionStore';
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

describe('GlobalSelectionHeader', function() {
  const {organization, router, routerContext} = initializeOrg({
    organization: TestStubs.Organization({features: ['global-views']}),
    router: {
      location: {query: {}},
    },
  });

  beforeAll(function() {
    jest.spyOn(globalActions, 'updateDateTime');
    jest.spyOn(globalActions, 'updateEnvironments');
    jest.spyOn(globalActions, 'updateProjects');

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/environments/`,
      body: TestStubs.Environments(),
    });
  });

  beforeEach(function() {
    GlobalSelectionStore.reset();
    [
      globalActions.updateDateTime,
      globalActions.updateProjects,
      globalActions.updateEnvironments,
      router.push,
    ].forEach(mock => mock.mockClear());
  });

  it('does not update router if there is custom routing', function() {
    mount(
      <GlobalSelectionHeader organization={organization} hasCustomRouting />,
      routerContext
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it('updates URL with values from store when mounted with no query params', function() {
    mount(<GlobalSelectionHeader organization={organization} />, routerContext);

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          environment: [],
          project: [],
          statsPeriod: '14d',
          utc: 'true',
        },
      })
    );
  });

  it('only updates GlobalSelection store when mounted with query params', async function() {
    mount(
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
    let wrapper = mount(
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
    expect(globalActions.updateProjects).toHaveBeenCalledWith([]);
    expect(globalActions.updateEnvironments).toHaveBeenCalledWith([]);

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

  it('does not update store if url params have not changed', async function() {
    let wrapper = mount(
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

  describe('Single project selection mode', function() {
    it('selects first project if more than one is requested', function() {
      const initializationObj = initializeOrg({
        router: {
          location: {query: {project: [1, 2]}},
        },
      });

      mount(
        <GlobalSelectionHeader organization={initializationObj.organization} />,
        initializationObj.routerContext
      );

      expect(globalActions.updateProjects).toHaveBeenCalledWith([1]);
    });

    it('selects first project if none (i.e. all) is requested', function() {
      const project = TestStubs.Project({id: '3'});
      const org = TestStubs.Organization({projects: [project]});
      const initializationObj = initializeOrg({
        organization: org,
        router: {
          location: {query: {}},
        },
      });

      mount(
        <GlobalSelectionHeader organization={initializationObj.organization} />,
        initializationObj.routerContext
      );

      expect(globalActions.updateProjects).toHaveBeenCalledWith([3]);
    });
  });
});
