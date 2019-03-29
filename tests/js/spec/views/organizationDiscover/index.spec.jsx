import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';

import {mount} from 'enzyme';
import {selectByValue} from 'app-test/helpers/select';
import GlobalSelectionStore from 'app/stores/globalSelectionStore';
import OrganizationDiscoverContainerWithStore, {
  OrganizationDiscoverContainer,
} from 'app/views/organizationDiscover';
import ProjectsStore from 'app/stores/projectsStore';
import Table from 'app/views/organizationDiscover/result/table';

jest.mock('app/views/organizationDiscover/result/table', () => jest.fn(() => null));

const results = {
  timing: {
    duration_ms: 29,
    timestamp: 1553819742,
    marks_ms: {
      execute: 11,
      rate_limit: 2,
      prepare_query: 11,
      get_configs: 0,
      dedupe_wait: 0,
      cache_get: 0,
      validate_schema: 3,
    },
  },
  meta: [{type: 'string', name: 'project.name'}, {type: 'string', name: 'title'}],
  data: [
    {
      'project.name': 'heart',
      title: "Blocked 'script' from 'example.com'",
    },
    {
      'project.name': 'heart',
      title: 'Exception: This is a test exception sent from the Raven CLI.',
    },
  ],
};

describe('OrganizationDiscoverContainer', function() {
  beforeEach(function() {
    browserHistory.push = jest.fn();
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  describe('new query', function() {
    let wrapper;
    const organization = TestStubs.Organization({
      projects: [TestStubs.Project({id: '1', slug: 'test-project'})],
      features: ['discover'],
    });
    beforeEach(async function() {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/query/?per_page=1000&cursor=0:0:1',
        method: 'POST',
        body: {
          data: [{tags_key: 'tag1', count: 5}, {tags_key: 'tag2', count: 1}],
          timing: {},
          meta: [],
        },
      });
      wrapper = mount(
        <OrganizationDiscoverContainer
          location={{query: {}, search: ''}}
          params={{}}
          selection={{projects: [], environments: [], datetime: {}}}
        />,
        TestStubs.routerContext([{organization}])
      );
      await tick();
    });

    it('fetches tags', function() {
      const queryBuilder = wrapper.instance().queryBuilder;
      expect(wrapper.state().isLoading).toBe(false);
      expect(queryBuilder.getColumns().some(column => column.name === 'tag1')).toBe(true);
      expect(queryBuilder.getColumns().some(column => column.name === 'tag2')).toBe(true);
    });

    it('sets active projects from global selection', async function() {
      ProjectsStore.loadInitialData(organization.projects);

      GlobalSelectionStore.reset({
        projects: [1],
        environments: [],
        datetime: {start: null, end: null, period: '14d'},
      });

      wrapper = mount(
        <OrganizationDiscoverContainerWithStore
          location={{query: {}, search: ''}}
          params={{}}
        />,
        TestStubs.routerContext([{organization}])
      );
      expect(wrapper.find('MultipleProjectSelector').text()).toBe('test-project');
    });
  });

  describe('saved query', function() {
    let wrapper, savedQueryMock, savedQueries;
    const organization = TestStubs.Organization({
      projects: [TestStubs.Project()],
      features: ['discover'],
    });
    beforeEach(async function() {
      savedQueries = [
        TestStubs.DiscoverSavedQuery({id: '1', name: 'one'}),
        TestStubs.DiscoverSavedQuery({id: '2', name: 'two'}),
      ];

      savedQueryMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/saved/1/',
        body: savedQueries[0],
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/saved/',
        body: savedQueries,
      });

      wrapper = mount(
        <OrganizationDiscoverContainer
          location={{query: {}, search: ''}}
          params={{savedQueryId: 1}}
          selection={{datetime: {}}}
        />,
        {
          ...TestStubs.routerContext([{organization}, {organization: PropTypes.object}]),
          disableLifecycleMethods: false,
        }
      );
      await tick();
      wrapper.update();
    });

    it('fetches saved query', function() {
      expect(savedQueryMock).toHaveBeenCalled();
    });

    it('navigates to second query', function() {
      const nextQueryMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/saved/2/',
        body: savedQueries[1],
      });

      expect(wrapper.find('SavedQueryListItem')).toHaveLength(2);

      wrapper.setProps({
        params: {savedQueryId: '2'},
      });

      expect(savedQueryMock).toHaveBeenCalledTimes(1);
      expect(nextQueryMock).toHaveBeenCalledTimes(1);
    });

    it('toggles edit mode', function() {
      wrapper.instance().toggleEditMode();
      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/discover/saved/1/',
        query: {editing: 'true'},
      });
    });
  });

  describe.only('updates results', function() {
    let wrapper, request;
    const organization = TestStubs.Organization({
      projects: [TestStubs.Project()],
      features: ['discover'],
    });
    const routerContext = TestStubs.routerContext([{organization}]);

    beforeAll(async function() {
      wrapper = mount(
        <OrganizationDiscoverContainerWithStore
          location={{query: {}, search: ''}}
          params={{}}
        />,
        routerContext
      );
      await tick();
      wrapper.update();
    });

    it('clears summarize fields', function() {
      wrapper
        .find('SelectControl[name="fields"] .Select-clear-zone')
        .simulate('mouseDown', {button: 0});

      expect(wrapper.find('SelectControl[name="fields"]').prop('value')).toEqual([]);
    });

    it('adds fields summarize fields', function() {
      selectByValue(wrapper, 'project.name', {name: 'fields', control: true});
      selectByValue(wrapper, 'title', {name: 'fields', control: true});

      expect(wrapper.find('SelectControl[name="fields"]').prop('value')).toEqual([
        'project.name',
        'title',
      ]);
    });

    it('adds count aggregation', function() {
      wrapper.find('Aggregations AddText Link').simulate('click');
      const AggregationSelect = wrapper.find('Aggregations SelectControl').first();

      AggregationSelect.find('input[role="combobox"]').simulate('focus');
      AggregationSelect.find('.Select-control').simulate('mouseDown', {button: 0});
      wrapper
        .find('Option')
        .findWhere(el => el.prop('option') && el.prop('option').value === 'count')
        .simulate('mouseDown');

      expect(
        wrapper
          .find('Aggregations SelectControl')
          .first()
          .prop('value')
      ).toEqual('count');
    });

    it('runs initial query', async function() {
      request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/query/?per_page=1000&cursor=0:0:1',
        method: 'POST',
        body: results,
      });
      wrapper.find('NewQuery button[aria-label="Run"]').simulate('click');
      await tick();
      wrapper.update();
      expect(request).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            aggregations: [['count()', null, 'count']],
            fields: ['project.name', 'title'],
          }),
        })
      );
      expect(Table).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            data: [
              {'project.name': 'heart', title: "Blocked 'script' from 'example.com'"},
              {
                'project.name': 'heart',
                title: 'Exception: This is a test exception sent from the Raven CLI.',
              },
            ],
          }),
        }),
        expect.anything()
      );
    });

    it('changes summarize fields', function() {
      wrapper
        .find('SelectControl[name="fields"] .Select-clear-zone')
        .simulate('mouseDown', {button: 0});

      selectByValue(wrapper, 'project.name', {name: 'fields', control: true});
      selectByValue(wrapper, 'message', {name: 'fields', control: true});

      expect(wrapper.find('SelectControl[name="fields"]').prop('value')).toEqual([
        'project.name',
        'message',
      ]);
    });

    it('runs 2nd query', async function() {
      request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/query/?per_page=1000&cursor=0:0:1',
        method: 'POST',
        body: {
          ...results,
          data: results.data.map(obj => ({
            'project.name': obj['project.name'],
            message: obj.title,
          })),
        },
      });
      wrapper.find('NewQuery button[aria-label="Run"]').simulate('click');
      await tick();
      wrapper.update();
      expect(request).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            aggregations: [['count()', null, 'count']],
            fields: ['project.name', 'message'],
          }),
        })
      );
      expect(Table).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            data: [
              {'project.name': 'heart', message: "Blocked 'script' from 'example.com'"},
              {
                'project.name': 'heart',
                message: 'Exception: This is a test exception sent from the Raven CLI.',
              },
            ],
          }),
        }),
        expect.anything()
      );
    });
  });

  describe('no access', function() {
    it('display no access message', async function() {
      const organization = TestStubs.Organization({projects: [TestStubs.Project()]});
      const wrapper = mount(
        <OrganizationDiscoverContainer
          location={{query: {}, search: ''}}
          params={{}}
          selection={{datetime: {}}}
        />,
        TestStubs.routerContext([{organization}])
      );
      expect(wrapper.text()).toBe("You don't have access to this feature");
    });
  });
});
