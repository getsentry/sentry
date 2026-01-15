import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {DisplayType} from 'sentry/views/dashboards/types';

import SpansWidgetQueries from './spansWidgetQueries';

describe('spansWidgetQueries', () => {
  const {organization} = initializeOrg();
  let widget = WidgetFixture();
  const selection = PageFiltersFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    widget = WidgetFixture();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(selection);
  });

  it('calculates the confidence for a single series', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [
          [1, [{count: 1}]],
          [2, [{count: 2}]],
          [3, [{count: 3}]],
        ],
        meta: {
          accuracy: {
            confidence: [
              {timestamp: 1, value: 'low'},
              {timestamp: 2, value: 'low'},
              {timestamp: 3, value: 'low'},
            ],
          },
        },
      },
    });

    render(
      <SpansWidgetQueries widget={widget} dashboardFilters={{}}>
        {({confidence}) => <div>{confidence}</div>}
      </SpansWidgetQueries>,
      {organization}
    );

    expect(await screen.findByText('low')).toBeInTheDocument();
  });

  it('calculates the confidence for a multi series', async () => {
    widget = WidgetFixture({
      queries: [
        {
          name: '',
          aggregates: ['a', 'b'],
          fields: ['a', 'b'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        a: {
          meta: {
            accuracy: {
              confidence: [
                {timestamp: 1, value: 'high'},
                {timestamp: 2, value: 'high'},
                {timestamp: 3, value: 'high'},
              ],
            },
          },
          data: [
            [1, [{count: 1}]],
            [2, [{count: 2}]],
            [3, [{count: 3}]],
          ],
        },
        b: {
          meta: {
            accuracy: {
              confidence: [
                {timestamp: 1, value: 'high'},
                {timestamp: 2, value: 'high'},
                {timestamp: 3, value: 'high'},
              ],
            },
          },
          data: [
            [1, [{count: 1}]],
            [2, [{count: 2}]],
            [3, [{count: 3}]],
          ],
        },
      },
    });

    render(
      <SpansWidgetQueries widget={widget} dashboardFilters={{}}>
        {({confidence}) => <div>{confidence}</div>}
      </SpansWidgetQueries>,
      {organization}
    );

    expect(await screen.findByText('high')).toBeInTheDocument();
  });

  it('triggers a normal mode request for charts', async () => {
    widget = WidgetFixture({
      queries: [
        {
          name: '',
          aggregates: ['a'],
          fields: ['a'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
      displayType: DisplayType.LINE,
    });

    const normalModeMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events-stats/`,
      body: {
        data: [
          [1, [{count: 1}]],
          [2, [{count: 2}]],
          [3, [{count: 3}]],
        ],
      },
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.sampling === 'NORMAL';
        },
      ],
    });

    PageFiltersStore.onInitializeUrlState({
      ...selection,
      datetime: {period: '24hr', end: null, start: null, utc: null},
    });

    render(
      <SpansWidgetQueries widget={widget} dashboardFilters={{}}>
        {({timeseriesResults}) => <div>{timeseriesResults?.[0]?.data?.[0]?.value}</div>}
      </SpansWidgetQueries>,
      {organization}
    );

    expect(await screen.findByText('1')).toBeInTheDocument();

    expect(normalModeMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          sampling: 'NORMAL',
        }),
      })
    );
  });

  it('triggers a normal mode request for tables', async () => {
    widget = WidgetFixture({
      queries: [
        {
          name: '',
          aggregates: ['a'],
          fields: ['a'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
      displayType: DisplayType.TABLE,
    });

    const normalModeMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events/`,
      body: {
        data: [{a: 'normal mode'}],
      },
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.sampling === 'NORMAL';
        },
      ],
    });

    PageFiltersStore.onInitializeUrlState({
      ...selection,
      datetime: {period: '24hr', end: null, start: null, utc: null},
    });

    render(
      <SpansWidgetQueries widget={widget} dashboardFilters={{}}>
        {({tableResults}) => <div>{tableResults?.[0]?.data?.[0]?.a}</div>}
      </SpansWidgetQueries>,
      {organization}
    );

    expect(await screen.findByText('normal mode')).toBeInTheDocument();

    expect(normalModeMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          sampling: 'NORMAL',
        }),
      })
    );
  });
});
