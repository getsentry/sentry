import {OrganizationFixture} from 'sentry-fixture/organization';
import {TelemetryClassifierFixture} from 'sentry-fixture/telemetryClassifier';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {TelemetryClassifier} from 'sentry/views/classifiers/types';

import {useClassifierListStats} from './useClassifierListStats';

const FRUSTRATION_FIELD = 'tags[sentry.enrichment.user_frustration,number]';
const TOOL_FIELD = 'tags[sentry.enrichment.tool_failure,number]';

function values(...counts: number[]) {
  return counts.map((value, index) => ({value, timestamp: 1_800_000_000_000 + index}));
}

describe('useClassifierListStats', () => {
  const organization = OrganizationFixture();
  const timeSeriesUrl = `/organizations/${organization.slug}/events-timeseries/`;

  const frustration = TelemetryClassifierFixture({id: '10', projectId: '1'});
  const toolFailure = TelemetryClassifierFixture({
    id: '11',
    projectId: '1',
    name: 'Tool failure',
    resultAttribute: 'tool_failure',
    binaryThreshold: 0.5,
  });

  function renderStats(classifiers: TelemetryClassifier[]) {
    return renderHookWithProviders(() => useClassifierListStats(classifiers), {
      organization,
    });
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('batches the classifiers of a project into one request per series', async () => {
    const matchesRequest = MockApiClient.addMockResponse({
      url: timeSeriesUrl,
      body: {
        timeSeries: [
          TimeSeriesFixture({yAxis: `count(${FRUSTRATION_FIELD})`, values: values(1, 2)}),
          TimeSeriesFixture({yAxis: `count(${TOOL_FIELD})`, values: values(4, 0)}),
        ],
      },
      match: [MockApiClient.matchQuery({referrer: 'api.classifiers.list.matches-chart'})],
    });
    const classifiedRequest = MockApiClient.addMockResponse({
      url: timeSeriesUrl,
      body: {
        timeSeries: [
          TimeSeriesFixture({
            yAxis: `count(${FRUSTRATION_FIELD})`,
            values: values(10, 20),
          }),
          TimeSeriesFixture({yAxis: `count(${TOOL_FIELD})`, values: values(5, 5)}),
        ],
      },
      match: [
        MockApiClient.matchQuery({referrer: 'api.classifiers.list.classified-chart'}),
      ],
    });

    const {result} = renderStats([frustration, toolFailure]);

    await waitFor(() => expect(result.current(frustration).isPending).toBe(false));
    expect(result.current(frustration).data).toEqual({
      classified: 30,
      hasMatches: true,
      matches: 3,
      series: values(1, 2),
    });
    expect(result.current(toolFailure).data).toEqual({
      classified: 10,
      hasMatches: true,
      matches: 4,
      series: values(4, 0),
    });

    expect(matchesRequest).toHaveBeenCalledTimes(1);
    expect(matchesRequest).toHaveBeenCalledWith(
      timeSeriesUrl,
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'enrichment_attributes',
          yAxis: [`count(${FRUSTRATION_FIELD})`, `count(${TOOL_FIELD})`],
          query: `(${FRUSTRATION_FIELD}:>=0.8) OR (${TOOL_FIELD}:>=0.5)`,
          project: [1],
          statsPeriod: '24h',
          interval: '1h',
        }),
      })
    );
    expect(classifiedRequest).toHaveBeenCalledTimes(1);
    expect(classifiedRequest).toHaveBeenCalledWith(
      timeSeriesUrl,
      expect.objectContaining({
        query: expect.objectContaining({
          query: `(has:${FRUSTRATION_FIELD}) OR (has:${TOOL_FIELD})`,
        }),
      })
    );
  });

  it('requests each project separately', async () => {
    const request = MockApiClient.addMockResponse({
      url: timeSeriesUrl,
      body: {timeSeries: []},
    });
    const otherProject = TelemetryClassifierFixture({id: '12', projectId: '2'});

    const {result} = renderStats([frustration, otherProject]);

    await waitFor(() => expect(result.current(otherProject).isPending).toBe(false));
    expect(request).toHaveBeenCalledTimes(4);
    expect(request).toHaveBeenCalledWith(
      timeSeriesUrl,
      expect.objectContaining({
        query: expect.objectContaining({
          project: [2],
          yAxis: [`count(${FRUSTRATION_FIELD})`],
          query: `(${FRUSTRATION_FIELD}:>=0.8)`,
        }),
      })
    );
    expect(result.current(otherProject).data).toEqual({
      classified: 0,
      hasMatches: true,
      matches: 0,
      series: [],
    });
  });

  it('counts every result for classifiers without matches', async () => {
    const request = MockApiClient.addMockResponse({
      url: timeSeriesUrl,
      body: {
        timeSeries: [
          TimeSeriesFixture({yAxis: `count(${FRUSTRATION_FIELD})`, values: values(3, 4)}),
        ],
      },
    });
    const classifier = TelemetryClassifierFixture({binaryThreshold: null});

    const {result} = renderStats([classifier]);

    await waitFor(() => expect(result.current(classifier).isPending).toBe(false));
    expect(result.current(classifier).data).toEqual({
      classified: 7,
      hasMatches: false,
      matches: 7,
      series: values(3, 4),
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('reports failed requests', async () => {
    MockApiClient.addMockResponse({url: timeSeriesUrl, statusCode: 500, body: {}});

    const {result} = renderStats([frustration]);

    await waitFor(() => expect(result.current(frustration).isError).toBe(true));
    expect(result.current(frustration).data).toBeUndefined();
  });
});
