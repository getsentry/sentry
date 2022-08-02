import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {Client} from 'sentry/api';
import ProjectsStore from 'sentry/stores/projectsStore';
import EventView from 'sentry/utils/discover/eventView';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {SpanOperationBreakdownFilter} from 'sentry/views/performance/transactionSummary/filter';
import {TagExplorer} from 'sentry/views/performance/transactionSummary/transactionOverview/tagExplorer';

const WrapperComponent = props => {
  return (
    <OrganizationContext.Provider value={props.organization}>
      <MEPSettingProvider _isMEPEnabled={false}>
        <TagExplorer {...props} />
      </MEPSettingProvider>
    </OrganizationContext.Provider>
  );
};

function initialize(projects, query, additionalFeatures = []) {
  const features = ['transaction-event', 'performance-view', ...additionalFeatures];
  const organization = TestStubs.Organization({
    features,
    projects,
  });
  const initialOrgData = {
    organization,
    router: {
      location: {
        query: {...query},
      },
    },
  };
  const initialData = initializeOrg(initialOrgData);
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

describe('WrapperComponent', function () {
  const facetUrl = '/organizations/org-slug/events-facets-performance/';
  let facetApiMock;
  beforeEach(function () {
    browserHistory.push = jest.fn();
    facetApiMock = MockApiClient.addMockResponse({
      url: facetUrl,
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
      <WrapperComponent
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

  it('Tag explorer uses LCP if projects are frontend', async function () {
    const projects = [TestStubs.Project({id: '123', platform: 'javascript-react'})];
    const {
      organization,
      location,
      eventView,
      api,
      spanOperationBreakdownFilter,
      transactionName,
    } = initialize(projects, {
      project: '123',
    });

    const wrapper = mountWithTheme(
      <WrapperComponent
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

    const durationHeader = wrapper.find('GridHeadCell StyledLink').first();
    expect(durationHeader.text().trim()).toEqual('Avg LCP');

    expect(facetApiMock).toHaveBeenCalledWith(
      facetUrl,
      expect.objectContaining({
        query: expect.objectContaining({
          aggregateColumn: 'measurements.lcp',
        }),
      })
    );
  });

  it('Tag explorer view all tags button links to tags page', async function () {
    const projects = [TestStubs.Project({id: '123', platform: 'javascript-react'})];
    const {
      organization,
      location,
      eventView,
      api,
      spanOperationBreakdownFilter,
      transactionName,
    } = initialize(
      projects,
      {
        project: '123',
      },
      []
    );

    const wrapper = mountWithTheme(
      <WrapperComponent
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

    const button = wrapper.find('Button[data-test-id="tags-explorer-open-tags"]');
    expect(button).toHaveLength(1);
    expect(button.prop('to')).toEqual({
      pathname: '/organizations/org-slug/performance/summary/tags/',
      query: {
        transaction: 'example-transaction',
        project: '123',
        tagKey: undefined,
        start: undefined,
        end: undefined,
        environment: undefined,
        query: undefined,
        statsPeriod: undefined,
      },
    });
  });

  it('Tag explorer uses the operation breakdown as a column', async function () {
    const projects = [TestStubs.Project({platform: 'javascript-react'})];
    const {organization, location, eventView, api, transactionName} = initialize(
      projects,
      {}
    );

    const wrapper = mountWithTheme(
      <WrapperComponent
        api={api}
        location={location}
        organization={organization}
        eventView={eventView}
        projects={projects}
        transactionName={transactionName}
        currentFilter={SpanOperationBreakdownFilter.Http}
      />
    );

    await tick();
    wrapper.update();

    const durationHeader = wrapper.find('GridHeadCell StyledLink').first();
    expect(durationHeader.text().trim()).toEqual('Avg Span Duration');

    expect(facetApiMock).toHaveBeenCalledWith(
      facetUrl,
      expect.objectContaining({
        query: expect.objectContaining({
          aggregateColumn: 'spans.http',
        }),
      })
    );
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
      <WrapperComponent
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
