import {getAlertTypeFromAggregateDataset} from 'app/views/alerts/wizard/utils';
import {Dataset} from 'app/views/settings/incidentRules/types';

describe('Wizard utils', function () {
  it('extracts lcp alert', function () {
    expect(
      getAlertTypeFromAggregateDataset({
        aggregate: 'p95(measurements.lcp)',
        dataset: Dataset.TRANSACTIONS,
      })
    ).toEqual('lcp');
    expect(
      getAlertTypeFromAggregateDataset({
        aggregate: 'percentile(measurements.lcp,0.7)',
        dataset: Dataset.TRANSACTIONS,
      })
    ).toEqual('lcp');
    expect(
      getAlertTypeFromAggregateDataset({
        aggregate: 'avg(measurements.lcp)',
        dataset: Dataset.TRANSACTIONS,
      })
    ).toEqual('lcp');
  });

  it('extracts duration alert', function () {
    expect(
      getAlertTypeFromAggregateDataset({
        aggregate: 'p95(transaction.duration)',
        dataset: Dataset.TRANSACTIONS,
      })
    ).toEqual('trans_duration');
    expect(
      getAlertTypeFromAggregateDataset({
        aggregate: 'percentile(transaction.duration,0.3)',
        dataset: Dataset.TRANSACTIONS,
      })
    ).toEqual('trans_duration');
    expect(
      getAlertTypeFromAggregateDataset({
        aggregate: 'avg(transaction.duration)',
        dataset: Dataset.TRANSACTIONS,
      })
    ).toEqual('trans_duration');
  });

  it('extracts throughput alert', function () {
    expect(
      getAlertTypeFromAggregateDataset({
        aggregate: 'count()',
        dataset: Dataset.TRANSACTIONS,
      })
    ).toEqual('throughput');
  });

  it('extracts user error alert', function () {
    expect(
      getAlertTypeFromAggregateDataset({
        aggregate: 'count_unique(tags[sentry:user])',
        dataset: Dataset.ERRORS,
      })
    ).toEqual('users_experiencing_errors');
  });

  it('extracts error count alert', function () {
    expect(
      getAlertTypeFromAggregateDataset({
        aggregate: 'count()',
        dataset: Dataset.ERRORS,
      })
    ).toEqual('num_errors');
  });

  it('defaults to num_errors', function () {
    expect(
      getAlertTypeFromAggregateDataset({
        aggregate: 'count_unique(tags[sentry:user])',
        dataset: Dataset.TRANSACTIONS,
      })
    ).toEqual('num_errors');
  });
});
