import {t} from 'sentry/locale';
import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';
import type {MetricDetectorConfig} from 'sentry/types/workflowEngine/detectors';
import getDuration from 'sentry/utils/duration/getDuration';

interface BaseDetectionParams {
  detectionType: MetricDetectorConfig['detectionType'];
  /**
   * Formatting units for the condition value.
   */
  thresholdSuffix: string;
}

interface PercentDetectionParams extends BaseDetectionParams {
  /**
   * Time delta in seconds used for percent detection.
   * Source: detector.config.comparison_delta
   */
  comparisonDelta: number;
  conditionType: DataConditionType | undefined;
  conditionValue: string | number | undefined;
  detectionType: 'percent';
}

interface StaticDetectionParams extends BaseDetectionParams {
  conditionType: DataConditionType | undefined;
  conditionValue: string | number | undefined;
  detectionType: 'static';
}

interface DynamicDetectionParams extends BaseDetectionParams {
  detectionType: 'dynamic';
}

type ResolutionDescriptionParams =
  | PercentDetectionParams
  | StaticDetectionParams
  | DynamicDetectionParams;

export function getResolutionDescription(params: ResolutionDescriptionParams): string {
  const suffix = params.thresholdSuffix;
  if (params.detectionType === 'dynamic') {
    return t(
      'Sentry will automatically resolve the issue when the trend goes back to baseline.'
    );
  }

  if (!params.conditionType || params.conditionValue === undefined) {
    return t('Resolution conditions not configured');
  }

  if (params.detectionType === 'static') {
    if (params.conditionType === DataConditionType.GREATER) {
      return t(
        'Issue will be resolved when the query value is less than %s%s.',
        params.conditionValue,
        suffix
      );
    }
    return t(
      'Issue will be resolved when the query value is more than %s%s.',
      params.conditionValue,
      suffix
    );
  }

  if (params.detectionType === 'percent') {
    const delta = params.comparisonDelta ?? 3600;
    if (params.conditionType === DataConditionType.GREATER) {
      return t(
        'Issue will be resolved when the query value is less than %s%% higher than the previous %s.',
        params.conditionValue,
        getDuration(delta)
      );
    }
    return t(
      'Issue will be resolved when the query value is less than %s%% lower than the previous %s.',
      params.conditionValue,
      getDuration(delta)
    );
  }

  return t('Resolution conditions not configured');
}
