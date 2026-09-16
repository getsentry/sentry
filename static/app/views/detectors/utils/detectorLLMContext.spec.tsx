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

import {detectorToLLMContext} from 'sentry/views/detectors/utils/detectorLLMContext';

describe('detectorToLLMContext', () => {
  it('reports the shared identity fields for every detector type', () => {
    const detector = MetricDetectorFixture({
      id: '42',
      name: 'Checkout latency',
      enabled: false,
      description: 'Watches p95 on checkout',
      owner: ActorFixture({type: 'team', name: 'backend'}),
      workflowIds: ['100', '101'],
    });

    expect(detectorToLLMContext(detector, 'project-slug')).toEqual(
      expect.objectContaining({
        id: '42',
        name: 'Checkout latency',
        type: 'metric_issue',
        enabled: false,
        project: 'project-slug',
        owner: 'team:backend',
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

    expect(config).toEqual(
      expect.objectContaining({
        aggregate: expect.any(String),
        dataset: expect.any(String),
        query: expect.any(String),
        timeWindowSeconds: expect.any(Number),
        detectionType: 'static',
        // Static detection carries no comparison delta.
        comparisonDelta: null,
      })
    );
    const thresholds = config.thresholds as {
      conditions: unknown[];
      logicType: string;
    };
    expect(thresholds.logicType).toEqual(expect.any(String));
    expect(thresholds.conditions.length).toBeGreaterThan(0);
    for (const condition of thresholds.conditions) {
      expect(condition).toEqual({
        type: expect.any(String),
        comparison: expect.anything(),
        priority: expect.anything(),
      });
    }
  });

  it('reports the comparison delta for percent-change detection', () => {
    const {config} = detectorToLLMContext(
      MetricDetectorFixture({config: {detectionType: 'percent', comparisonDelta: 10}}),
      'project-slug'
    );

    expect(config).toEqual(
      expect.objectContaining({detectionType: 'percent', comparisonDelta: 10})
    );
  });

  it('reports the request and thresholds for an uptime monitor, and never its credentials', () => {
    const {config} = detectorToLLMContext(UptimeDetectorFixture(), 'project-slug');

    expect(config).toEqual({
      url: 'https://example.com',
      method: 'GET',
      intervalSeconds: 60,
      timeoutMs: 5000,
      traceSampling: false,
      downtimeThreshold: 3,
      recoveryThreshold: 1,
      mode: 1,
      environment: 'production',
    });
    // Request headers and body can hold auth tokens — they must not reach a prompt.
    expect(config).not.toHaveProperty('headers');
    expect(config).not.toHaveProperty('body');
  });

  it('reports the schedule for a cron monitor, not the whole Monitor object', () => {
    const {config} = detectorToLLMContext(CronDetectorFixture(), 'project-slug');

    expect(config).toEqual(
      expect.objectContaining({
        schedule: expect.anything(),
        scheduleType: expect.any(String),
        failureIssueThreshold: 1,
        recoveryThreshold: 2,
        environments: expect.any(Array),
      })
    );
    // The cron data source is an entire Monitor; its project and per-environment
    // check-in state stay out of the payload.
    expect(config).not.toHaveProperty('project');
    expect(config).not.toHaveProperty('owner');
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
    ['error', ErrorDetectorFixture()],
    ['issue_stream', IssueStreamDetectorFixture()],
    ['issue_stream (all projects)', AllProjectsDetectorFixture()],
  ])('reports identity only for a %s detector', (_label, detector) => {
    const result = detectorToLLMContext(detector, 'project-slug');

    expect(result.config).toEqual({});
    expect(result.id).toEqual(expect.any(String));
    expect(result.name).toEqual(expect.any(String));
  });
});
