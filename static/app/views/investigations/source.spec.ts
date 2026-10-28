import {
  InvestigationDetailFixture,
  InvestigationMetricSourceFixture,
} from 'sentry/views/investigations/fixtures';
import {
  getInvestigationSource,
  getSourceMonitor,
} from 'sentry/views/investigations/source';

describe('getInvestigationSource', () => {
  it('reads the issue and monitor name of a metric source', () => {
    const investigation = InvestigationDetailFixture({
      source: InvestigationMetricSourceFixture(),
    });

    expect(getInvestigationSource(investigation)).toEqual({
      groupId: '123',
      monitorName: 'Checkout error rate',
    });
  });

  it('keeps the issue when the snapshot does not parse', () => {
    const investigation = InvestigationDetailFixture({
      source: {
        type: 'metric_open_period',
        ref: {groupId: '123', openPeriodId: '456'},
        revision: null,
        snapshot: {monitor: {id: '789', name: 'Checkout error rate'}},
      },
    });

    expect(getInvestigationSource(investigation)).toEqual({
      groupId: '123',
      monitorName: null,
    });
  });

  it('has no issue for a manual investigation', () => {
    expect(getInvestigationSource(InvestigationDetailFixture())).toEqual({
      groupId: null,
      monitorName: null,
    });
  });
});

describe('getSourceMonitor', () => {
  it('returns the snapshot monitor with its project', () => {
    expect(getSourceMonitor(InvestigationMetricSourceFixture(), '789')).toEqual(
      expect.objectContaining({
        id: '789',
        name: 'Checkout error rate',
        projectSlug: 'checkout-api',
      })
    );
  });

  it('returns nothing for a different monitor', () => {
    expect(getSourceMonitor(InvestigationMetricSourceFixture(), '42')).toBeNull();
  });

  it('keeps the sensitivity settings of a dynamic monitor', () => {
    const comparison = {sensitivity: 'medium', seasonality: 'auto', threshold_type: 0};
    const source = InvestigationMetricSourceFixture({
      detectionType: 'dynamic',
      conditions: [{type: 'anomaly_detection', comparison, result: 75}],
    });

    expect(getSourceMonitor(source, '789')?.conditions).toEqual([
      {type: 'anomaly_detection', comparison, result: 75},
    ]);
  });

  it('drops only the conditions it cannot read', () => {
    const source = InvestigationMetricSourceFixture({
      conditions: [
        {type: 'between', comparison: 100, result: 75},
        {type: 'gt', comparison: 100, result: 75},
      ],
    });

    expect(getSourceMonitor(source, '789')).toEqual(
      expect.objectContaining({
        name: 'Checkout error rate',
        conditions: [{type: 'gt', comparison: 100, result: 75}],
      })
    );
  });

  it('reads a static monitor from a snapshot without a detection type', () => {
    const source = InvestigationMetricSourceFixture({detectionType: undefined});

    expect(getSourceMonitor(source, '789')?.detectionType).toBe('static');
  });

  it('reads a percent monitor from a snapshot without a detection type', () => {
    const source = InvestigationMetricSourceFixture({
      detectionType: undefined,
      comparisonDeltaSeconds: 3600,
    });

    expect(getSourceMonitor(source, '789')?.detectionType).toBe('percent');
  });
});
