import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import type {UseInfiniteLogsQueryResult} from 'sentry/views/explore/logs/useLogsQuery';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

import {LogsDownSamplingAlert} from './logsDownsamplingAlert';

const organization = OrganizationFixture();

function ProviderWrapper({children}: {children: React.ReactNode}) {
  return (
    <LogsQueryParamsProvider
      analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
      source="location"
    >
      {children}
    </LogsQueryParamsProvider>
  );
}

function makeTimeSeries(
  dataScanned: 'partial' | 'full',
  sampleCount: number
): TimeSeries {
  return {
    yAxis: 'count()',
    meta: {
      interval: 3600000,
      valueType: 'integer',
      valueUnit: null,
      dataScanned,
    },
    values: [{timestamp: 0, value: 10, sampleCount}],
  };
}

function makeTableResult(
  dataScanned: 'full' | 'partial' | undefined,
  rowCount: number
): UseInfiniteLogsQueryResult {
  return {
    dataScanned,
    data: Array.from({length: rowCount}, (_, i) => ({id: String(i)})),
  } as unknown as UseInfiniteLogsQueryResult;
}

function makeTimeseriesResult(
  series: TimeSeries[]
): ReturnType<typeof useSortedTimeSeries> {
  return {
    data: series.length ? {key: series} : {},
  } as unknown as ReturnType<typeof useSortedTimeSeries>;
}

const ALERT_TEXT = /volume of logs in this time range is too large/i;

describe('LogsDownSamplingAlert', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the alert when timeseries is partial, table is full, and timeseries has fewer samples', () => {
    render(
      <LogsDownSamplingAlert
        tableResult={makeTableResult('full', 100)}
        timeseriesResult={makeTimeseriesResult([makeTimeSeries('partial', 10)])}
      />,
      {organization, additionalWrapper: ProviderWrapper}
    );

    expect(screen.getByText(ALERT_TEXT)).toBeInTheDocument();
  });

  it('does not render when table data is also partial', () => {
    render(
      <LogsDownSamplingAlert
        tableResult={makeTableResult('partial', 100)}
        timeseriesResult={makeTimeseriesResult([makeTimeSeries('partial', 10)])}
      />,
      {organization, additionalWrapper: ProviderWrapper}
    );

    expect(screen.queryByText(ALERT_TEXT)).not.toBeInTheDocument();
  });

  it('does not render when timeseries data is full', () => {
    render(
      <LogsDownSamplingAlert
        tableResult={makeTableResult('full', 100)}
        timeseriesResult={makeTimeseriesResult([makeTimeSeries('full', 10)])}
      />,
      {organization, additionalWrapper: ProviderWrapper}
    );

    expect(screen.queryByText(ALERT_TEXT)).not.toBeInTheDocument();
  });

  it('does not render when timeseries sample count is not less than table row count', () => {
    render(
      <LogsDownSamplingAlert
        tableResult={makeTableResult('full', 10)}
        timeseriesResult={makeTimeseriesResult([makeTimeSeries('partial', 100)])}
      />,
      {organization, additionalWrapper: ProviderWrapper}
    );

    expect(screen.queryByText(ALERT_TEXT)).not.toBeInTheDocument();
  });

  it('renders a dismiss button in the alert', () => {
    render(
      <LogsDownSamplingAlert
        tableResult={makeTableResult('full', 100)}
        timeseriesResult={makeTimeseriesResult([makeTimeSeries('partial', 10)])}
      />,
      {organization, additionalWrapper: ProviderWrapper}
    );

    expect(screen.getByRole('button', {name: 'Dismiss Alert'})).toBeInTheDocument();
  });

  it('hides the alert after the dismiss button is clicked', async () => {
    render(
      <LogsDownSamplingAlert
        tableResult={makeTableResult('full', 100)}
        timeseriesResult={makeTimeseriesResult([makeTimeSeries('partial', 10)])}
      />,
      {organization, additionalWrapper: ProviderWrapper}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Dismiss Alert'}));

    expect(screen.queryByText(ALERT_TEXT)).not.toBeInTheDocument();
  });

  it('stays hidden when remounted after dismissal', async () => {
    const props = {
      tableResult: makeTableResult('full', 100),
      timeseriesResult: makeTimeseriesResult([makeTimeSeries('partial', 10)]),
    };

    const {unmount} = render(<LogsDownSamplingAlert {...props} />, {
      organization,
      additionalWrapper: ProviderWrapper,
    });

    await userEvent.click(screen.getByRole('button', {name: 'Dismiss Alert'}));
    unmount();

    render(<LogsDownSamplingAlert {...props} />, {
      organization,
      additionalWrapper: ProviderWrapper,
    });

    expect(screen.queryByText(ALERT_TEXT)).not.toBeInTheDocument();
  });
});
