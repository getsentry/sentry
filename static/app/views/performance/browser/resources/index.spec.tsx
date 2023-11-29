import {Organization} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {DetailedOrganization} from 'sentry/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import ResourcesLandingPage from 'sentry/views/performance/browser/resources';
import {SpanFunction, SpanMetricsField} from 'sentry/views/starfish/types';

const {
  SPAN_SELF_TIME,
  SPAN_GROUP,
  HTTP_RESPONSE_CONTENT_LENGTH,
  SPAN_DOMAIN,
  SPAN_DESCRIPTION,
  PROJECT_ID,
  RESOURCE_RENDER_BLOCKING_STATUS,
  SPAN_OP,
} = SpanMetricsField;
const {SPM, TIME_SPENT_PERCENTAGE} = SpanFunction;

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useOrganization');

const requestMocks: Record<string, jest.Mock> = {};

describe('ResourcesLandingPage', function () {
  const organization = Organization({
    features: [
      'starfish-browser-resource-module-ui',
      'starfish-view',
      'performance-database-view',
    ],
  });

  beforeEach(() => {
    setupMocks(organization);
    setupMockRequests(organization);
  });

  afterEach(function () {
    jest.resetAllMocks();
  });

  it('renders a list of resources', async () => {
    render(<ResourcesLandingPage />);
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(
      screen.getByRole('cell', {name: 'https://*.sentry-cdn.com/123.js'})
    ).toBeInTheDocument();

    expect(
      screen.getByRole('cell', {name: 'https://*.sentry-cdn.com/456.js'})
    ).toBeInTheDocument();
  });

  it('contains correct query in charts', async () => {
    render(<ResourcesLandingPage />);
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(requestMocks.mainTable.mock.calls).toMatchInlineSnapshot(`
[
  [
    "/organizations/org-slug/events/",
    {
      "error": [Function],
      "method": "GET",
      "query": {
        "dataset": "spansMetrics",
        "environment": [],
        "field": [
          "span.description",
          "span.op",
          "count()",
          "avg(span.self_time)",
          "spm()",
          "span.group",
          "span.domain",
          "avg(http.response_content_length)",
          "project.id",
          "time_spent_percentage()",
          "sum(span.self_time)",
        ],
        "per_page": 100,
        "project": [],
        "query": "!span.description:"browser-extension://*" ( span.op:resource.script OR file_extension:css OR file_extension:[woff,woff2,ttf,otf,eot] ) ",
        "referrer": "api.performance.browser.resources.main-table",
        "sort": "-time_spent_percentage()",
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

const setupMocks = (organization: DetailedOrganization) => {
  jest.mocked(usePageFilters).mockReturnValue({
    isReady: true,
    desyncedFilters: new Set(),
    pinnedFilters: new Set(),
    shouldPersist: true,
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
  });

  jest.mocked(useLocation).mockReturnValue({
    pathname: '',
    search: '',
    query: {statsPeriod: '10d'},
    hash: '',
    state: undefined,
    action: 'PUSH',
    key: '',
  });

  jest.mocked(useOrganization).mockReturnValue(organization);
};

const setupMockRequests = (organization: DetailedOrganization) => {
  requestMocks.mainTable = MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events/`,
    method: 'GET',
    match: [
      MockApiClient.matchQuery({
        referrer: 'api.performance.browser.resources.main-table',
      }),
    ],
    body: {
      data: [
        {
          [`avg(${HTTP_RESPONSE_CONTENT_LENGTH})`]: 123,
          [`avg(${SPAN_SELF_TIME})`]: 123,
          [RESOURCE_RENDER_BLOCKING_STATUS]: 123,
          [SPAN_DESCRIPTION]: 'https://*.sentry-cdn.com/123.js',
          [SPAN_DOMAIN]: ['https://*.sentry-cdn.com'],
          [PROJECT_ID]: 123,
          [SPAN_OP]: 'resource.script',
          [SPAN_GROUP]: 'group123',
          [`${SPM}()`]: 123,
          [`${TIME_SPENT_PERCENTAGE}()`]: 0.5,
          [`sum(${SPAN_SELF_TIME})`]: 123,
          'count()': 123,
        },
        {
          [`avg(${HTTP_RESPONSE_CONTENT_LENGTH})`]: 123,
          [`avg(${SPAN_SELF_TIME})`]: 123,
          [RESOURCE_RENDER_BLOCKING_STATUS]: 123,
          [SPAN_DESCRIPTION]: 'https://*.sentry-cdn.com/456.js',
          [SPAN_DOMAIN]: ['https://*.sentry-cdn.com'],
          [PROJECT_ID]: 123,
          [SPAN_OP]: 'resource.script',
          [SPAN_GROUP]: 'group123',
          [`${SPM}()`]: 123,
          [`${TIME_SPENT_PERCENTAGE}()`]: 0.5,
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
        referrer: 'api.performance.browser.resources.page-selector',
      }),
    ],
    body: {
      data: [{transaction: '/page/123/', 'count()': 1}],
    },
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events/`,
    method: 'GET',
    match: [MockApiClient.matchQuery({referrer: 'api.starfish.get-span-domains'})],
    body: {
      data: [{'span.domain': ['*.sentry-cdn.com'], count: 1}],
    },
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events-stats/`,
    method: 'GET',
    match: [MockApiClient.matchQuery({referrer: 'api.starfish.span-time-charts'})],
    body: {
      [`${SPM}()`]: {
        data: [
          [1699907700, [{count: 7810.2}]],
          [1699908000, [{count: 1216.8}]],
        ],
      },
      [`avg(${SPAN_SELF_TIME})`]: {
        data: [
          [1699907700, [{count: 1111.2}]],
          [1699908000, [{count: 2222.8}]],
        ],
      },
    },
  });
};
