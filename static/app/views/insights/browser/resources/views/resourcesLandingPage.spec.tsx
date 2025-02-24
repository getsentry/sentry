import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import ResourcesLandingPage from 'sentry/views/insights/browser/resources/views/resourcesLandingPage';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {SpanFunction, SpanMetricsField} from 'sentry/views/insights/types';

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
jest.mock('sentry/utils/useProjects');
jest.mock('sentry/views/insights/common/queries/useOnboardingProject');

const requestMocks: Record<string, jest.Mock> = {};

describe('ResourcesLandingPage', function () {
  const organization = OrganizationFixture({
    features: ['insights-initial-modules'],
  });

  beforeEach(() => {
    setupMocks();
    setupMockRequests(organization);
  });

  afterEach(function () {
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
      "cancelable": undefined,
      "error": [Function],
      "method": "GET",
      "query": {
        "dataset": "spansMetrics",
        "environment": [],
        "field": [
          "span.domain",
          "count()",
        ],
        "per_page": 100,
        "project": [],
        "query": "has:span.description span.module:resource !span.description:"browser-extension://*" span.op:[resource.script,resource.css,resource.font,resource.img]",
        "referrer": "api.starfish.get-span-domains",
        "sort": "-count",
        "statsPeriod": "10d",
      },
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
      "cancelable": undefined,
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
          "avg(http.response_content_length)",
          "project.id",
          "time_spent_percentage()",
          "sum(span.self_time)",
        ],
        "per_page": 100,
        "project": [],
        "query": "!span.description:"browser-extension://*" ( span.op:resource.script OR file_extension:css OR file_extension:[woff,woff2,ttf,otf,eot] OR file_extension:[jpg,jpeg,png,gif,svg,webp,apng,avif] OR span.op:resource.img ) ",
        "referrer": "api.performance.browser.resources.main-table",
        "sort": "-time_spent_percentage()",
        "statsPeriod": "10d",
      },
      "success": [Function],
    },
  ],
]
`);
  });
});

const setupMocks = () => {
  jest.mocked(useOnboardingProject).mockReturnValue(undefined);
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

  jest.mocked(useProjects).mockReturnValue({
    fetchError: null,
    fetching: false,
    hasMore: false,
    initiallyLoaded: true,
    projects: [ProjectFixture({hasInsightsAssets: true})],
    onSearch: jest.fn(),
    reloadProjects: jest.fn(),
    placeholders: [],
  });
};

const setupMockRequests = (organization: Organization) => {
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
    match: [
      MockApiClient.matchQuery({
        referrer: 'api.performance.resource.resource-landing',
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
