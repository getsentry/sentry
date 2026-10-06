import {ActorFixture} from 'sentry-fixture/actor';
import {
  AllProjectsDetectorFixture,
  CronDetectorFixture,
  ErrorDetectorFixture,
  IssueStreamDetectorFixture,
  MetricDetectorFixture,
  PreprodDetectorFixture,
  UptimeDetectorFixture,
} from 'sentry-fixture/detectors';

import {
  DataConditionGroupLogicType,
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {detectorToLLMContext} from 'sentry/views/detectors/utils/detectorLLMContext';

describe('detectorToLLMContext', () => {
  it('reports the shared identity fields', () => {
    const detector = MetricDetectorFixture({
      id: '42',
      name: 'Checkout latency',
      enabled: false,
      description: 'Watches p95 on checkout',
      owner: ActorFixture({id: '7', type: 'team', name: 'backend'}),
      workflowIds: ['100', '101'],
    });

    expect(detectorToLLMContext(detector, 'project-slug')).toEqual(
      expect.objectContaining({
        id: '42',
        name: 'Checkout latency',
        type: 'metric_issue',
        enabled: false,
        projectSlug: 'project-slug',
        owner: {type: 'team', id: '7', name: 'backend'},
        description: 'Watches p95 on checkout',
        connectedAlertIds: ['100', '101'],
      })
    );
  });

  it('reports a null owner rather than omitting it', () => {
    const {owner} = detectorToLLMContext(
      MetricDetectorFixture({owner: null}),
      'project-slug'
    );

    expect(owner).toBeNull();
  });

  it('reports the query and thresholds for a metric monitor', () => {
    const {config} = detectorToLLMContext(MetricDetectorFixture(), 'project-slug');

    expect(config).toEqual({
      aggregate: 'count()',
      dataset: 'events',
      query: 'is:unresolved',
      eventTypes: ['error'],
      timeWindowSeconds: 60,
      detectionType: 'static',
      // Static detection carries no comparison delta and counts have no unit.
      comparisonDelta: null,
      thresholdSuffix: '',
      thresholds: {
        logicType: DataConditionGroupLogicType.ANY,
        conditions: [
          {
            type: DataConditionType.GREATER,
            comparison: 8,
            priority: DetectorPriorityLevel.HIGH,
          },
          {
            type: DataConditionType.LESS_OR_EQUAL,
            comparison: 8,
            priority: DetectorPriorityLevel.OK,
          },
        ],
      },
    });
  });

  it('converts a percent-change threshold to the delta the page shows', () => {
    const detector = MetricDetectorFixture({
      config: {detectionType: 'percent', comparisonDelta: 3600},
      conditionGroup: {
        id: '1',
        logicType: DataConditionGroupLogicType.ANY,
        conditions: [
          {
            id: '1',
            type: DataConditionType.GREATER,
            comparison: 110,
            conditionResult: DetectorPriorityLevel.HIGH,
          },
        ],
      },
    });

    const {config} = detectorToLLMContext(detector, 'project-slug');

    // The backend stores 110 for "10% higher than baseline"; sending the raw
    // 110 alongside detectionType 'percent' would read as a 110% threshold.
    expect(config.thresholds).toEqual({
      logicType: DataConditionGroupLogicType.ANY,
      conditions: [
        {
          type: DataConditionType.GREATER,
          comparison: 10,
          priority: DetectorPriorityLevel.HIGH,
        },
      ],
    });
    expect(config.thresholdSuffix).toBe('%');
  });

  it('reports the request and thresholds for an uptime monitor, never its credentials', () => {
    const {config} = detectorToLLMContext(UptimeDetectorFixture(), 'project-slug');

    // Exact match: the uptime data source also holds `headers` and `body`,
    // which routinely carry auth tokens and must not reach a prompt.
    expect(config).toEqual({
      url: 'https://example.com',
      method: 'GET',
      intervalSeconds: 60,
      timeoutMs: 5000,
      traceSampling: false,
      downtimeThreshold: 3,
      recoveryThreshold: 1,
      autoDetected: false,
    });
  });

  it('reports the schedule for a cron monitor, not the whole Monitor object', () => {
    const {config} = detectorToLLMContext(CronDetectorFixture(), 'project-slug');

    // Exact match: the cron data source is an entire Monitor, so its project,
    // owner and per-environment check-in state stay out of the payload.
    expect(config).toEqual({
      schedule: expect.anything(),
      scheduleType: expect.any(String),
      timezone: 'UTC',
      checkinMarginMinutes: null,
      maxRuntimeMinutes: null,
      failureIssueThreshold: 1,
      recoveryThreshold: 2,
      status: expect.any(String),
      environments: expect.any(Array),
    });
  });

  it('reports the measurement and thresholds for a mobile build monitor', () => {
    const {config} = detectorToLLMContext(PreprodDetectorFixture(), 'project-slug');

    expect(config).toEqual(
      expect.objectContaining({
        measurement: 'install_size',
        thresholdType: 'absolute',
        query: null,
      })
    );
  });

  it.each([
    ['metric', MetricDetectorFixture()],
    ['uptime', UptimeDetectorFixture()],
    ['cron', CronDetectorFixture()],
  ])('does not throw when a %s detector has null dataSources', (_label, detector) => {
    const withoutDataSources = {...detector, dataSources: null} as unknown as Detector;

    expect(() => detectorToLLMContext(withoutDataSources, 'project-slug')).not.toThrow();
  });

  it.each([
    ['error', ErrorDetectorFixture()],
    ['issue_stream', IssueStreamDetectorFixture()],
    ['issue_stream (all projects)', AllProjectsDetectorFixture()],
  ])('reports identity only for a %s detector', (_label, detector) => {
    expect(detectorToLLMContext(detector, 'project-slug').config).toEqual({});
  });
});
