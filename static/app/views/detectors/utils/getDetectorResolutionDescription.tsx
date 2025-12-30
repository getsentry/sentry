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
  detectionType: 'percent';
  highThreshold: string | number | undefined;
  resolutionThreshold: string | number | undefined;
}

interface StaticDetectionParams extends BaseDetectionParams {
  conditionType: DataConditionType | undefined;
  detectionType: 'static';
  highThreshold: string | number | undefined;
  resolutionThreshold: string | number | undefined;
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

  // Use resolutionThreshold if provided, otherwise fall back to highThreshold
  const threshold =
    params.resolutionThreshold === undefined
      ? params.highThreshold
      : params.resolutionThreshold;

  if (!params.conditionType || threshold === undefined) {
    return t('Resolution conditions not configured');
  }

  if (params.detectionType === 'static') {
    if (params.conditionType === DataConditionType.GREATER) {
      return t(
        'Issue will be resolved when the query value is below or equal to %s%s.',
        threshold,
        suffix
      );
    }
    return t(
      'Issue will be resolved when the query value is above or equal to %s%s.',
      threshold,
      suffix
    );
  }

  if (params.detectionType === 'percent') {
    const delta = params.comparisonDelta ?? 3600;
    if (params.conditionType === DataConditionType.GREATER) {
      return t(
        'Issue will be resolved when the query value is below or equal to %s%% higher than the previous %s.',
        threshold,
        getDuration(delta)
      );
    }
    return t(
      'Issue will be resolved when the query value is below or equal to %s%% lower than the previous %s.',
      threshold,
      getDuration(delta)
    );
  }

  return t('Resolution conditions not configured');
}
