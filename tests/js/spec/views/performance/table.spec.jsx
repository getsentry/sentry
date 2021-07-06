import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import ProjectsStore from 'app/stores/projectsStore';
import EventView from 'app/utils/discover/eventView';
import Table from 'app/views/performance/table';

const FEATURES = ['performance-view'];

function initializeData(projects, query, features = FEATURES) {
  const organization = TestStubs.Organization({
    features,
    projects,
  });
  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: query || {},
      },
    },
  });
  ProjectsStore.loadInitialData(initialData.organization.projects);
  return initialData;
}

function openContextMenu(wrapper, cellIndex) {
  const menu = wrapper.find('CellAction').at(cellIndex);
  // Hover over the menu
  menu.find('Container > div').at(0).simulate('mouseEnter');
  wrapper.update();

  // Open the menu
  wrapper.find('MenuButton').simulate('click');

  // Return the menu wrapper so we can interact with it.
  return wrapper.find('CellAction').at(cellIndex).find('Menu');
}

describe('Performance > Table', function () {
  const project1 = TestStubs.Project();
  const project2 = TestStubs.Project();
  const projects = [project1, project2];
  const eventView = new EventView({
    id: '1',
    name: 'my query',
    fields: [
      {
        field: 'team_key_transaction',
      },
      {
        field: 'transaction',
      },
      {
        field: 'project',
      },
      {
        field: 'tpm()',
      },
      {
        field: 'p50()',
      },
      {
        field: 'p95()',
      },
      {
        field: 'failure_rate()',
      },
      {
        field: 'apdex()',
      },
      {
        field: 'count_unique(user)',
      },
      {
        field: 'count_miserable(user)',
      },
      {
        field: 'user_misery()',
      },
    ],
    sorts: [{field: 'tpm  ', kind: 'desc'}],
    query: '',
    project: [project1.id, project2.id],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: [],
  });
  beforeEach(function () {
    browserHistory.push = jest.fn();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {
        meta: {
          user: 'string',
          transaction: 'string',
          project: 'string',
          tpm: 'number',
          p50: 'number',
          p95: 'number',
          failure_rate: 'number',
          apdex: 'number',
          count_unique_user: 'number',
          count_miserable_user: 'number',
          user_misery: 'number',
        },
        data: [
          {
            key_transaction: 1,
            transaction: '/apple/cart',
            project: project1.slug,
            user: 'uhoh@example.com',
            tpm: 30,
            p50: 100,
            p95: 500,
            failure_rate: 0.1,
            apdex: 0.6,
            count_unique_user: 1000,
            count_miserable_user: 122,
            user_misery: 0.114,
            project_threshold_config: ['duration', 300],
          },
          {
            key_transaction: 0,
            transaction: '/apple/checkout',
            project: project2.slug,
            user: 'uhoh@example.com',
            tpm: 30,
            p50: 100,
            p95: 500,
            failure_rate: 0.1,
            apdex: 0.6,
            count_unique_user: 1000,
            count_miserable_user: 122,
            user_misery: 0.114,
            project_threshold_config: ['duration', 300],
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/key-transactions-list/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/legacy-key-transactions-count/`,
      body: [],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
  });

  it('renders correct cell actions without feature', async function () {
    const data = initializeData(projects, {query: 'event.type:transaction'});

    const wrapper = mountWithTheme(
      <Table
        eventView={eventView}
        organization={data.organization}
        location={data.router.location}
        setError={jest.fn()}
        summaryConditions=""
        projects={projects}
      />
    );

    await tick();
    wrapper.update();
    const firstRow = wrapper.find('GridBody').find('GridRow').at(0);
    const userMiseryCell = firstRow.find('GridBodyCell').at(9);
    const cellAction = userMiseryCell.find('CellAction');

    expect(cellAction.prop('allowActions')).toEqual([
      'add',
      'exclude',
      'show_greater_than',
      'show_less_than',
    ]);

    const menu = openContextMenu(wrapper, 8); // User Misery Cell Action
    expect(menu.find('MenuButtons').find('ActionItem')).toHaveLength(2);
  });

  it('renders correct cell actions with feature', async function () {
    const data = initializeData(projects, {query: 'event.type:transaction'}, [
      'performance-view',
      'project-transaction-threshold-override',
    ]);

    const wrapper = mountWithTheme(
      <Table
        eventView={eventView}
        organization={data.organization}
        location={data.router.location}
        setError={jest.fn()}
        summaryConditions=""
        projects={projects}
      />
    );

    await tick();
    wrapper.update();
    const firstRow = wrapper.find('GridBody').find('GridRow').at(0);
    const userMiseryCell = firstRow.find('GridBodyCell').at(9);
    const cellAction = userMiseryCell.find('CellAction');

    expect(cellAction.prop('allowActions')).toEqual([
      'add',
      'exclude',
      'show_greater_than',
      'show_less_than',
      'edit_threshold',
    ]);

    const menu = openContextMenu(wrapper, 8); // User Misery Cell Action
    expect(menu.find('MenuButtons').find('ActionItem')).toHaveLength(3);
    expect(menu.find('MenuButtons').find('ActionItem').at(2).text()).toEqual(
      'Edit threshold (300ms)'
    );
  });
});
