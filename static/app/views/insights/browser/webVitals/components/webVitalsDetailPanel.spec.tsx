import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {
  webVitalCountField,
  webVitalP75Field,
  webVitalScoreCountField,
  webVitalScoreField,
} from 'sentry/views/dashboards/utils/webVitalTraceMetricFields';
import {MOBILE_BROWSER_TYPES} from 'sentry/views/insights/browser/webVitals/utils/deviceType';

import {WebVitalsDetailPanel} from './webVitalsDetailPanel';

const DESKTOP_FILTER = new MutableSearch('')
  .addFilterValueList('!browser.name', MOBILE_BROWSER_TYPES)
  .formatString();

describe('WebVitalsDetailPanel', () => {
  const organization = OrganizationFixture();
  let eventsMock: jest.Mock;
  let eventsStatsMock: jest.Mock;

  beforeEach(() => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture());

    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: []},
    });
    eventsStatsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      body: {timeSeries: []},
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders correctly with empty results', async () => {
    render(<WebVitalsDetailPanel webVital="lcp" />, {organization});
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
    // Raw web vital metric tile queries
    expect(eventsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'spans',
          field: [
            'p75(browser.web_vital.lcp.value)',
            'p75(browser.web_vital.fcp.value)',
            'p75(browser.web_vital.cls.value)',
            'p75(browser.web_vital.ttfb.value)',
            'p75(browser.web_vital.inp.value)',
            'count()',
          ],
          query: `span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvital.cls,ui.webvital.lcp,pageload,""] ${DESKTOP_FILTER}`,
        }),
      })
    );
    // Project performance score ring query
    expect(eventsMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'spans',
          field: [
            'performance_score(measurements.score.lcp)',
            'performance_score(measurements.score.fcp)',
            'performance_score(measurements.score.cls)',
            'performance_score(measurements.score.inp)',
            'performance_score(measurements.score.ttfb)',
            'performance_score(measurements.score.total)',
            'avg(measurements.score.weight.lcp)',
            'avg(measurements.score.weight.fcp)',
            'avg(measurements.score.weight.cls)',
            'avg(measurements.score.weight.inp)',
            'avg(measurements.score.weight.ttfb)',
            'count()',
            'count_scores(measurements.score.total)',
            'count_scores(measurements.score.lcp)',
            'count_scores(measurements.score.fcp)',
            'count_scores(measurements.score.cls)',
            'count_scores(measurements.score.ttfb)',
            'count_scores(measurements.score.inp)',
            'sum(measurements.score.weight.lcp)',
          ],
          query: `span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvital.cls,ui.webvital.lcp,pageload,""] ${DESKTOP_FILTER}`,
        }),
      })
    );
    // Table query
    expect(eventsMock).toHaveBeenNthCalledWith(
      3,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'spans',
          field: [
            'project.id',
            'project',
            'transaction',
            'p75(browser.web_vital.lcp.value)',
            'p75(browser.web_vital.fcp.value)',
            'p75(browser.web_vital.cls.value)',
            'p75(browser.web_vital.ttfb.value)',
            'p75(browser.web_vital.inp.value)',
            'performance_score(measurements.score.lcp)',
            'opportunity_score(measurements.score.lcp)',
            'performance_score(measurements.score.total)',
            'count()',
            'count_scores(measurements.score.lcp)',
            'count_scores(measurements.score.fcp)',
            'count_scores(measurements.score.cls)',
            'count_scores(measurements.score.inp)',
            'count_scores(measurements.score.ttfb)',
            'count_scores(measurements.score.total)',
            'opportunity_score(measurements.score.total)',
          ],
          query: `span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvital.cls,ui.webvital.lcp,pageload,""] avg(measurements.score.total):>=0 count_scores(measurements.score.lcp):>0 ${DESKTOP_FILTER}`,
        }),
      })
    );
    expect(eventsStatsMock).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('Largest Contentful Paint (P75)')).toHaveLength(2);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(
      screen.getByText(/Largest Contentful Paint \(LCP\) measures the render/)
    ).toBeInTheDocument();
  });

  it('narrows mixed browser filters to the selected device type', async () => {
    render(<WebVitalsDetailPanel webVital="lcp" />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/insights/browser/pageloads/`,
          query: {
            'browser.name': ['Chrome', 'Chrome Mobile'],
            'user.geo.subregion': ['21', '154'],
          },
        },
        route: '/organizations/:orgId/insights/browser/pageloads/',
      },
    });
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    const listFilters = 'user.geo.subregion:[21,154] browser.name:[Chrome]';
    expect(eventsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          query: `span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvital.cls,ui.webvital.lcp,pageload,""] ${listFilters}`,
        }),
      })
    );
    expect(eventsMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          query: `span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvital.cls,ui.webvital.lcp,pageload,""] browser.name:[Chrome] user.geo.subregion:[21,154]`,
        }),
      })
    );
    expect(eventsMock).toHaveBeenNthCalledWith(
      3,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          query: `span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvital.cls,ui.webvital.lcp,pageload,""] avg(measurements.score.total):>=0 count_scores(measurements.score.lcp):>0 browser.name:[Chrome] user.geo.subregion:[21,154]`,
        }),
      })
    );

    eventsMock.mockClear();
    await userEvent.click(screen.getByRole('radio', {name: 'Mobile'}));
    expect(eventsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          query: `span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvital.cls,ui.webvital.lcp,pageload,""] user.geo.subregion:[21,154] browser.name:["Chrome Mobile"]`,
        }),
      })
    );
  });

  it('hides the device type selector when the browser filter has one device type', async () => {
    render(<WebVitalsDetailPanel webVital="lcp" />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/insights/browser/pageloads/`,
          query: {'browser.name': ['Chrome Mobile']},
        },
        route: '/organizations/:orgId/insights/browser/pageloads/',
      },
    });
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(screen.queryByRole('radio', {name: 'Mobile'})).not.toBeInTheDocument();
    expect(eventsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          query: `span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvital.cls,ui.webvital.lcp,pageload,""] browser.name:["Chrome Mobile"]`,
        }),
      })
    );
  });

  it('queries trace metrics with the given search', async () => {
    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {
            transaction: '/home',
            project: 'frontend',
            'project.id': 1,
            [webVitalP75Field('lcp')]: 2000,
            [webVitalScoreField('lcp')]: 0.5,
            [webVitalScoreCountField('lcp')]: 10,
            [webVitalCountField('ttfb')]: 20,
          },
        ],
      },
    });

    render(
      <WebVitalsDetailPanel webVital="lcp" metricsQuery="user.geo.subregion:[21]" />,
      {organization}
    );

    // Half of the page's 10 scores are missing, out of 10 scores overall
    expect(await screen.findByRole('link', {name: '/home'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '50'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '20'})).toBeInTheDocument();

    const query = `user.geo.subregion:[21] ${DESKTOP_FILTER}`;
    expect(eventsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'tracemetrics',
          field: [
            'project.id',
            'project',
            'transaction',
            'p75(value,browser.web_vital.lcp,distribution,millisecond)',
            'avg(tags[score.ratio.lcp,number],browser.web_vital.lcp,distribution,millisecond)',
            'count(tags[score.ratio.lcp,number],browser.web_vital.lcp,distribution,millisecond)',
            'count(value,browser.web_vital.ttfb,distribution,millisecond)',
          ],
          sort: '-count(tags[score.ratio.lcp,number],browser.web_vital.lcp,distribution,millisecond)',
          query,
        }),
      })
    );
    expect(eventsMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({query: expect.objectContaining({dataset: 'spans'})})
    );
    expect(eventsStatsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'tracemetrics',
          yAxis: ['p75(value,browser.web_vital.lcp,distribution,millisecond)'],
          query,
        }),
      })
    );
  });

  it('shows no value when the trace metrics row lacks the vital', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {
            transaction: '/home',
            project: 'frontend',
            'project.id': 1,
            [webVitalP75Field('lcp')]: 2000,
            [webVitalP75Field('cls')]: null,
            [webVitalScoreField('cls')]: 0.5,
            [webVitalScoreCountField('cls')]: 10,
          },
        ],
      },
    });

    render(<WebVitalsDetailPanel webVital="cls" metricsQuery="" />, {organization});

    expect(await screen.findByRole('link', {name: '/home'})).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
