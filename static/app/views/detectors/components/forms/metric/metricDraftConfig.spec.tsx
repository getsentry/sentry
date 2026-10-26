import {parseDetectorDraftValues} from 'sentry/views/detectors/components/forms/common/detectorDraft';
import {METRIC_DETECTOR_DRAFT_CONFIG} from 'sentry/views/detectors/components/forms/metric/metricDraftConfig';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';

describe('METRIC_DETECTOR_DRAFT_CONFIG', () => {
  it('drops dataset-specific fields when the dataset is invalid', () => {
    const values = parseDetectorDraftValues(METRIC_DETECTOR_DRAFT_CONFIG, {
      aggregateFunction: 'p75(span.duration)',
      dataset: 'not-a-dataset',
      name: 'Monitor',
      query: 'span.op:http.client',
    });

    expect(values).toEqual({name: 'Monitor'});
  });

  it('drops the detection type when the dataset does not support it', () => {
    const values = parseDetectorDraftValues(METRIC_DETECTOR_DRAFT_CONFIG, {
      dataset: DetectorDataset.RELEASES,
      detectionType: 'dynamic',
    });

    expect(values).toEqual({dataset: DetectorDataset.RELEASES});
  });

  it('drops thresholds when they are not numeric', () => {
    const values = parseDetectorDraftValues(METRIC_DETECTOR_DRAFT_CONFIG, {
      highThreshold: 'abc',
      mediumThreshold: '',
      resolutionValue: '12.5',
    });

    expect(values).toEqual({mediumThreshold: '', resolutionValue: '12.5'});
  });

  it('ignores inherited keys when given a crafted prototype', () => {
    const values = parseDetectorDraftValues(
      METRIC_DETECTOR_DRAFT_CONFIG,
      JSON.parse('{"__proto__": {"name": "Inherited"}}')
    );

    expect(values).toEqual({});
  });
});
