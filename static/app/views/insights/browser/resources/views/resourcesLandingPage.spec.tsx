import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import ResourcesLandingPage from 'sentry/views/insights/browser/resources/views/resourcesLandingPage';
import {SpanFields, SpanFunction} from 'sentry/views/insights/types';

const {
  SPAN_SELF_TIME,
  SPAN_GROUP,
  HTTP_RESPONSE_CONTENT_LENGTH,
  SPAN_DOMAIN,
  NORMALIZED_DESCRIPTION,
  PROJECT_ID,
  RESOURCE_RENDER_BLOCKING_STATUS,
  SPAN_OP,
} = SpanFields;
const {EPM} = SpanFunction;

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useReleaseStats');

const requestMocks: Record<string, jest.Mock> = {};

describe('ResourcesLandingPage', () => {
  const organization = OrganizationFixture({
    features: ['insight-modules'],
  });

  beforeEach(() => {
    setupMocks();
    setupMockRequests(organization);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders a list of resources', async () => {
    render(<ResourcesLandingPage />, {organization});
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(
      screen.getByRole('cell', {name: 'https://*.sentry-cdn.com/123.js'})
    ).toBeInTheDocument();

    expect(
      screen.getByRole('cell', {name: 'https://*.sentry-cdn.com/456.js'})
    ).toBeInTheDocument();
  });

  it('fetches domain data', async () => {
    render(<ResourcesLandingPage />, {organization});
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(requestMocks.domainSelector!.mock.calls).toMatchInlineSnapshot(`
[
  [
    "/organizations/org-slug/events/",
    {
      "error": [Function],
      "method": "GET",
      "query": {
        "dataset": "spans",
        "environment": [],
        "field": [
          "span.domain",
          "count()",
        ],
        "per_page": 100,
        "project": [],
        "query": "has:sentry.normalized_description span.category:resource !sentry.normalized_description:"browser-extension://*" span.op:[resource.script,resource.css,resource.font,resource.img]",
        "referrer": "api.insights.get-span-domains",
        "sampling": "NORMAL",
        "sort": "-count()",
        "statsPeriod": "10d",
      },
      "skipAbort": undefined,
      "success": [Function],
    },
  ],
]
`);
  });

  it('contains correct query in charts', async () => {
    render(<ResourcesLandingPage />, {organization});
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(requestMocks.mainTable!.mock.calls).toMatchInlineSnapshot(`
[
  [
    "/organizations/org-slug/events/",
    {
      "error": [Function],
      "method": "GET",
      "query": {
        "dataset": "spans",
        "environment": [],
        "field": [
          "sentry.normalized_description",
          "span.op",
          "count()",
          "avg(span.self_time)",
          "epm()",
          "span.group",
          "avg(http.response_content_length)",
          "project.id",
          "sum(span.self_time)",
        ],
        "per_page": 100,
        "project": [],
        "query": "has:sentry.normalized_description !sentry.normalized_description:"browser-extension://*" ( span.op:resource.script OR file_extension:css OR file_extension:[woff,woff2,ttf,otf,eot] OR file_extension:[jpg,jpeg,png,gif,svg,webp,apng,avif] OR span.op:resource.img ) ",
        "referrer": "api.insights.browser.resources.main-table",
        "sampling": "NORMAL",
        "sort": "-sum(span.self_time)",
        "statsPeriod": "10d",
      },
      "skipAbort": undefined,
      "success": [Function],
    },
  ],
]
`);
  });
});

const setupMocks = () => {
  jest.mocked(usePageFilters).mockReturnValue(
    PageFilterStateFixture({
      selection: {
        datetime: {
          period: '10d',
          start: null,
          end: null,
          utc: false,
        },
        environments: [],
        projects: [],
      },
    })
  );

  jest.mocked(useLocation).mockReturnValue({
    pathname: '',
    search: '',
    query: {statsPeriod: '10d'},
    hash: '',
    state: undefined,
    action: 'PUSH',
    key: '',
  });

  ProjectsStore.loadInitialData([
    ProjectFixture({hasInsightsAssets: true, firstTransactionEvent: true}),
  ]);
  jest.mocked(useReleaseStats).mockReturnValue({
    isLoading: false,
    isPending: false,
    isError: false,
    error: null,
    releases: [],
  });
};

const setupMockRequests = (organization: Organization) => {
  requestMocks.mainTable = MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events/`,
    method: 'GET',
    match: [
      MockApiClient.matchQuery({
        referrer: 'api.insights.browser.resources.main-table',
      }),
    ],
    body: {
      data: [
        {
          [`avg(${HTTP_RESPONSE_CONTENT_LENGTH})`]: 123,
          [`avg(${SPAN_SELF_TIME})`]: 123,
          [RESOURCE_RENDER_BLOCKING_STATUS]: 123,
          [NORMALIZED_DESCRIPTION]: 'https://*.sentry-cdn.com/123.js',
          [SPAN_DOMAIN]: ['https://*.sentry-cdn.com'],
          [PROJECT_ID]: 123,
          [SPAN_OP]: 'resource.script',
          [SPAN_GROUP]: 'group123',
          [`${EPM}()`]: 123,
          [`sum(${SPAN_SELF_TIME})`]: 123,
          'count()': 123,
        },
        {
          [`avg(${HTTP_RESPONSE_CONTENT_LENGTH})`]: 123,
          [`avg(${SPAN_SELF_TIME})`]: 123,
          [RESOURCE_RENDER_BLOCKING_STATUS]: 123,
          [NORMALIZED_DESCRIPTION]: 'https://*.sentry-cdn.com/456.js',
          [SPAN_DOMAIN]: ['https://*.sentry-cdn.com'],
          [PROJECT_ID]: 123,
          [SPAN_OP]: 'resource.script',
          [SPAN_GROUP]: 'group123',
          [`${EPM}()`]: 123,
          [`sum(${SPAN_SELF_TIME})`]: 123,
          'count()': 123,
        },
      ],
    },
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events/`,
    method: 'GET',
    match: [
      MockApiClient.matchQuery({
        referrer: 'api.insights.browser.resources.page-selector',
      }),
    ],
    body: {
      data: [{transaction: '/page/123/', 'count()': 1}],
    },
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events/`,
    method: 'GET',
    match: [
      MockApiClient.matchQuery({
        referrer: 'api.insights.resource.resource-landing',
      }),
    ],
    body: {
      data: [{'count()': 43374}],
      meta: {
        fields: {'count()': 'integer'},
      },
    },
  });

  requestMocks.domainSelector = MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events/`,
    method: 'GET',
    match: [MockApiClient.matchQuery({referrer: 'api.insights.get-span-domains'})],
    body: {
      data: [{'span.domain': ['*.sentry-cdn.com'], count: 1}],
    },
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events-timeseries/`,
    method: 'GET',
    match: [
      MockApiClient.matchQuery({
        referrer: 'api.insights.resource.resource-landing-series',
      }),
    ],
    body: {
      timeSeries: [
        TimeSeriesFixture({
          yAxis: `${EPM}()`,
        }),
        TimeSeriesFixture({
          yAxis: `avg(${SPAN_SELF_TIME})`,
        }),
      ],
    },
  });

  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/events/`,
    method: 'GET',
    match: [
      MockApiClient.matchQuery({
        referrer: 'api.insights.user-geo-subregion-selector',
      }),
    ],
    body: {
      data: [
        {'user.geo.subregion': '21', 'count()': 123},
        {'user.geo.subregion': '155', 'count()': 123},
      ],
      meta: {
        fields: {'user.geo.subregion': 'string', 'count()': 'integer'},
      },
    },
  });
};
