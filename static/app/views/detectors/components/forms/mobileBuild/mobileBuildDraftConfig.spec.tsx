import {parseDetectorDraftValues} from 'sentry/views/detectors/components/forms/common/detectorDraft';
import {PREPROD_DETECTOR_DRAFT_CONFIG} from 'sentry/views/detectors/components/forms/mobileBuild/mobileBuildDraftConfig';

describe('PREPROD_DETECTOR_DRAFT_CONFIG', () => {
  it('drops thresholds when the threshold type is invalid', () => {
    const values = parseDetectorDraftValues(PREPROD_DETECTOR_DRAFT_CONFIG, {
      highThreshold: '10',
      lowThreshold: '5',
      thresholdType: 'not-a-type',
    });

    expect(values).toEqual({});
  });

  it('keeps thresholds when the threshold type is valid', () => {
    const values = parseDetectorDraftValues(PREPROD_DETECTOR_DRAFT_CONFIG, {
      highThreshold: '10',
      thresholdType: 'relative_diff',
    });

    expect(values).toEqual({highThreshold: '10', thresholdType: 'relative_diff'});
  });
});
