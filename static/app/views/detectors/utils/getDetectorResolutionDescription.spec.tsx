import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';
import {getResolutionDescription} from 'sentry/views/detectors/utils/getDetectorResolutionDescription';

describe('getDetectorResolutionDescription', function () {
  describe('dynamic detection type', function () {
    it('returns automatic resolution message for dynamic detection', function () {
      const result = getResolutionDescription({
        detectionType: 'dynamic',
        thresholdSuffix: '%',
      });

      expect(result).toBe(
        'Sentry will automatically resolve the issue when the trend goes back to baseline.'
      );
    });
  });

  describe('static detection type', function () {
    it('returns less than message for GREATER condition', function () {
      const result = getResolutionDescription({
        detectionType: 'static',
        conditionType: DataConditionType.GREATER,
        conditionValue: 100,
        thresholdSuffix: '%',
      });

      expect(result).toBe(
        'Issue will be resolved when the query value is less than 100%.'
      );
    });

    it('returns more than message for non-GREATER condition', function () {
      const result = getResolutionDescription({
        detectionType: 'static',
        conditionType: DataConditionType.LESS,
        conditionValue: 50,
        thresholdSuffix: 'ms',
      });

      expect(result).toBe(
        'Issue will be resolved when the query value is more than 50ms.'
      );
    });

    it('handles empty threshold suffix', function () {
      const result = getResolutionDescription({
        detectionType: 'static',
        conditionType: DataConditionType.GREATER,
        conditionValue: 100,
        thresholdSuffix: '',
      });

      expect(result).toBe(
        'Issue will be resolved when the query value is less than 100.'
      );
    });
  });

  describe('percent detection type', function () {
    it('returns higher than message for GREATER condition', function () {
      const result = getResolutionDescription({
        detectionType: 'percent',
        conditionType: DataConditionType.GREATER,
        conditionValue: 25,
        comparisonDelta: 3600, // 1 hour
        thresholdSuffix: '%',
      });

      expect(result).toBe(
        'Issue will be resolved when the query value is less than 25% higher than the previous 1 hour.'
      );
    });

    it('returns not configured message when conditionType is undefined', function () {
      const result = getResolutionDescription({
        detectionType: 'percent',
        conditionType: undefined,
        conditionValue: 25,
        comparisonDelta: 3600,
        thresholdSuffix: '%',
      });

      expect(result).toBe('Resolution conditions not configured');
    });

    it('returns not configured message when conditionValue is undefined', function () {
      const result = getResolutionDescription({
        detectionType: 'percent',
        conditionType: DataConditionType.GREATER,
        conditionValue: undefined,
        comparisonDelta: 3600,
        thresholdSuffix: '%',
      });

      expect(result).toBe('Resolution conditions not configured');
    });

    it('returns lower than message for non-GREATER condition', function () {
      const result = getResolutionDescription({
        detectionType: 'percent',
        conditionType: DataConditionType.LESS,
        conditionValue: 15,
        comparisonDelta: 7200, // 2 hours
        thresholdSuffix: '%',
      });

      expect(result).toBe(
        'Issue will be resolved when the query value is less than 15% lower than the previous 2 hours.'
      );
    });

    it('formats different time durations correctly', function () {
      const result = getResolutionDescription({
        detectionType: 'percent',
        conditionType: DataConditionType.GREATER,
        conditionValue: 20,
        comparisonDelta: 300, // 5 minutes
        thresholdSuffix: '%',
      });

      expect(result).toBe(
        'Issue will be resolved when the query value is less than 20% higher than the previous 5 minutes.'
      );
    });
  });
});
