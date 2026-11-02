import {PREPROD_DETECTOR_DRAFT_SCHEMA} from 'sentry/views/detectors/components/forms/mobileBuild/mobileBuildDraftConfig';

describe('PREPROD_DETECTOR_DRAFT_SCHEMA', () => {
  it('drops thresholds when the threshold type is invalid', () => {
    const values = PREPROD_DETECTOR_DRAFT_SCHEMA.parse({
      highThreshold: '10',
      lowThreshold: '5',
      thresholdType: 'not-a-type',
    });

    expect(values).toStrictEqual({thresholdType: undefined});
  });

  it('keeps thresholds when the threshold type is valid', () => {
    const values = PREPROD_DETECTOR_DRAFT_SCHEMA.parse({
      highThreshold: '10',
      thresholdType: 'relative_diff',
    });

    expect(values).toStrictEqual({highThreshold: '10', thresholdType: 'relative_diff'});
  });
});
