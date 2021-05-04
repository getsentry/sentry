import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {Client} from 'app/api';
import ProjectsStore from 'app/stores/projectsStore';
import EventView from 'app/utils/discover/eventView';
import {SpanOperationBreakdownFilter} from 'app/views/performance/transactionSummary/filter';
import {TagExplorer} from 'app/views/performance/transactionSummary/tagExplorer';

function initialize(projects, query) {
  const features = ['transaction-event', 'performance-view'];
  const organization = TestStubs.Organization({
    features,
    projects,
  });
  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: {...query},
      },
    },
  });
  ProjectsStore.loadInitialData(initialData.organization.projects);
  const eventView = EventView.fromLocation(initialData.router.location);

  const api = new Client();

  const spanOperationBreakdownFilter = SpanOperationBreakdownFilter.None;
  const transactionName = 'example-transaction';

  return {
    ...initialData,
    spanOperationBreakdownFilter,
    transactionName,
    location: initialData.router.location,
    eventView,
    api,
  };
}

describe('TagExplorer', function () {
  beforeEach(function () {
    browserHistory.push = jest.fn();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-facets-performance/',
      body: {
        data: [
          {
            tags_key: 'browser.name',
            tags_value: 'Chrome',
            sumdelta: 547.4285714285729,
            count: 44,
            frequency: 0.6285714285714286,
            comparison: 1.0517781861420388,
            aggregate: 252.72727272727272,
          },
          {
            tags_key: 'client_os',
            tags_value: 'Mac OS X 10.15.7',
            sumdelta: 547.4285714285729,
            count: 44,
            frequency: 0.6285714285714286,
            comparison: 1.0517781861420388,
            aggregate: 252.72727272727272,
          },
        ],
        meta: {
          tags_key: 'string',
          tags_value: 'string',
          sumdelta: 'duration',
          count: 'integer',
          frequency: 'number',
          comparison: 'number',
          aggregate: 'number',
        },
      },
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
  });

  it('renders basic UI elements', async function () {
    const projects = [TestStubs.Project()];
    const {
      organization,
      location,
      eventView,
      api,
      spanOperationBreakdownFilter,
      transactionName,
    } = initialize(projects, {});

    const wrapper = mountWithTheme(
      <TagExplorer
        api={api}
        location={location}
        organization={organization}
        eventView={eventView}
        projects={projects}
        transactionName={transactionName}
        currentFilter={spanOperationBreakdownFilter}
      />
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('TagsHeader')).toHaveLength(1);
    expect(wrapper.find('GridEditable')).toHaveLength(1);
  });

  it('Check sort links of headers', async function () {
    const projects = [TestStubs.Project()];
    const {
      organization,
      location,
      eventView,
      api,
      spanOperationBreakdownFilter,
      transactionName,
    } = initialize(projects, {});

    const wrapper = mountWithTheme(
      <TagExplorer
        api={api}
        location={location}
        organization={organization}
        eventView={eventView}
        projects={projects}
        transactionName={transactionName}
        currentFilter={spanOperationBreakdownFilter}
      />
    );

    await tick();
    wrapper.update();

    const headerCells = wrapper.find('GridHeadCell StyledLink');

    const expectedSortedHeaders = [
      {
        name: 'avg duration',
        sort: '-aggregate',
      },
      {
        name: 'Frequency',
        sort: '-frequency',
      },
      {
        name: 'Compared to avg',
        sort: '-comparison',
      },
      {
        name: 'Total time lost',
        sort: 'sumdelta',
      },
    ];
    expect(headerCells).toHaveLength(expectedSortedHeaders.length);

    expectedSortedHeaders.forEach((expectedHeader, index) => {
      const frequencyHeader = headerCells.at(index);

      expect(frequencyHeader.text().trim().toLowerCase()).toEqual(
        expectedHeader.name.toLowerCase()
      );
      expect(frequencyHeader.props().to).toEqual(
        expect.objectContaining({
          query: expect.objectContaining({
            tagSort: [expectedHeader.sort],
            tags_cursor: undefined,
          }),
        })
      );
    });
  });
});
