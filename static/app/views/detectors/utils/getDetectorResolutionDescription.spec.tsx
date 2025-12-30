import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';
import {getResolutionDescription} from 'sentry/views/detectors/utils/getDetectorResolutionDescription';

describe('getDetectorResolutionDescription', () => {
  describe('dynamic detection type', () => {
    it('returns automatic resolution message for dynamic detection', () => {
      const result = getResolutionDescription({
        detectionType: 'dynamic',
        thresholdSuffix: '%',
      });

      expect(result).toBe(
        'Sentry will automatically resolve the issue when the trend goes back to baseline.'
      );
    });
  });

  describe('static detection type', () => {
    it('returns less than message for GREATER condition', () => {
      const result = getResolutionDescription({
        detectionType: 'static',
        conditionType: DataConditionType.GREATER,
        highThreshold: 100,
        resolutionThreshold: undefined,
        thresholdSuffix: '%',
      });

      expect(result).toBe(
        'Issue will be resolved when the query value is below or equal to 100%.'
      );
    });

    it('returns more than message for non-GREATER condition', () => {
      const result = getResolutionDescription({
        detectionType: 'static',
        conditionType: DataConditionType.LESS,
        highThreshold: 50,
        resolutionThreshold: undefined,
        thresholdSuffix: 'ms',
      });

      expect(result).toBe(
        'Issue will be resolved when the query value is above or equal to 50ms.'
      );
    });

    it('handles empty threshold suffix', () => {
      const result = getResolutionDescription({
        detectionType: 'static',
        conditionType: DataConditionType.GREATER,
        highThreshold: 100,
        resolutionThreshold: undefined,
        thresholdSuffix: '',
      });

      expect(result).toBe(
        'Issue will be resolved when the query value is below or equal to 100.'
      );
    });

    it('uses resolutionThreshold instead of highThreshold when provided for GREATER condition', () => {
      const result = getResolutionDescription({
        detectionType: 'static',
        conditionType: DataConditionType.GREATER,
        highThreshold: 100,
        resolutionThreshold: 75,
        thresholdSuffix: '%',
      });

      expect(result).toBe(
        'Issue will be resolved when the query value is below or equal to 75%.'
      );
    });

    it('uses resolutionThreshold instead of highThreshold when provided for LESS condition', () => {
      const result = getResolutionDescription({
        detectionType: 'static',
        conditionType: DataConditionType.LESS,
        highThreshold: 50,
        resolutionThreshold: 80,
        thresholdSuffix: 'ms',
      });

      expect(result).toBe(
        'Issue will be resolved when the query value is above or equal to 80ms.'
      );
    });
  });

  describe('percent detection type', () => {
    it('returns higher than message for GREATER condition', () => {
      const result = getResolutionDescription({
        detectionType: 'percent',
        conditionType: DataConditionType.GREATER,
        highThreshold: 25,
        resolutionThreshold: undefined,
        comparisonDelta: 3600, // 1 hour
        thresholdSuffix: '%',
      });

      expect(result).toBe(
        'Issue will be resolved when the query value is below or equal to 25% higher than the previous 1 hour.'
      );
    });

    it('returns not configured message when conditionType is undefined', () => {
      const result = getResolutionDescription({
        detectionType: 'percent',
        conditionType: undefined,
        highThreshold: 25,
        resolutionThreshold: undefined,
        comparisonDelta: 3600,
        thresholdSuffix: '%',
      });

      expect(result).toBe('Resolution conditions not configured');
    });

    it('returns not configured message when conditionValue is undefined', () => {
      const result = getResolutionDescription({
        detectionType: 'percent',
        conditionType: DataConditionType.GREATER,
        highThreshold: undefined,
        resolutionThreshold: undefined,
        comparisonDelta: 3600,
        thresholdSuffix: '%',
      });

      expect(result).toBe('Resolution conditions not configured');
    });

    it('returns lower than message for non-GREATER condition', () => {
      const result = getResolutionDescription({
        detectionType: 'percent',
        conditionType: DataConditionType.LESS,
        highThreshold: 15,
        resolutionThreshold: undefined,
        comparisonDelta: 7200, // 2 hours
        thresholdSuffix: '%',
      });

      expect(result).toBe(
        'Issue will be resolved when the query value is below or equal to 15% lower than the previous 2 hours.'
      );
    });

    it('formats different time durations correctly', () => {
      const result = getResolutionDescription({
        detectionType: 'percent',
        conditionType: DataConditionType.GREATER,
        highThreshold: 20,
        resolutionThreshold: undefined,
        comparisonDelta: 300, // 5 minutes
        thresholdSuffix: '%',
      });

      expect(result).toBe(
        'Issue will be resolved when the query value is below or equal to 20% higher than the previous 5 minutes.'
      );
    });

    it('uses resolutionThreshold instead of highThreshold when provided', () => {
      const result = getResolutionDescription({
        detectionType: 'percent',
        conditionType: DataConditionType.GREATER,
        highThreshold: 25,
        resolutionThreshold: 15,
        comparisonDelta: 3600,
        thresholdSuffix: '%',
      });

      expect(result).toBe(
        'Issue will be resolved when the query value is below or equal to 15% higher than the previous 1 hour.'
      );
    });
  });
});
