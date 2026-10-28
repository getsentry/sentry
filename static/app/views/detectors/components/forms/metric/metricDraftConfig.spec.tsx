import {METRIC_DETECTOR_DRAFT_SCHEMA} from 'sentry/views/detectors/components/forms/metric/metricDraftConfig';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';

describe('METRIC_DETECTOR_DRAFT_SCHEMA', () => {
  it('drops dataset-specific fields when the dataset is invalid', () => {
    const values = METRIC_DETECTOR_DRAFT_SCHEMA.parse({
      aggregateFunction: 'p75(span.duration)',
      dataset: 'not-a-dataset',
      name: 'Monitor',
      query: 'span.op:http.client',
    });

    expect(values).toStrictEqual({dataset: undefined, name: 'Monitor'});
  });

  it('drops the detection type when the dataset does not support it', () => {
    const values = METRIC_DETECTOR_DRAFT_SCHEMA.parse({
      dataset: DetectorDataset.RELEASES,
      detectionType: 'dynamic',
    });

    expect(values).toStrictEqual({dataset: DetectorDataset.RELEASES});
  });

  it('drops thresholds when they are not numeric', () => {
    const values = METRIC_DETECTOR_DRAFT_SCHEMA.parse({
      highThreshold: 'abc',
      mediumThreshold: '',
      resolutionValue: '12.5',
    });

    expect(values).toStrictEqual({
      highThreshold: undefined,
      mediumThreshold: '',
      resolutionValue: '12.5',
    });
  });

  it('drops fields when they are not in the schema', () => {
    const values = METRIC_DETECTOR_DRAFT_SCHEMA.parse({
      name: 'Monitor',
      unknownField: 'value',
    });

    expect(values).toStrictEqual({name: 'Monitor'});
  });

  it('crops the description when it is too long', () => {
    const values = METRIC_DETECTOR_DRAFT_SCHEMA.parse({
      description: '😀'.repeat(1200),
    });

    expect(values).toStrictEqual({description: '😀'.repeat(1024)});
  });
});
