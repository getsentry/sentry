import {t} from 'sentry/locale';
import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';
import getDuration from 'sentry/utils/duration/getDuration';

interface ResolutionDescriptionParams {
  comparisonDelta: number | undefined;
  conditionType: DataConditionType | undefined;
  conditionValue: number | undefined;
  detectionType: string;
  thresholdSuffix: string | undefined;
}

export function getResolutionDescription({
  detectionType,
  conditionType,
  conditionValue,
  comparisonDelta,
  thresholdSuffix,
}: ResolutionDescriptionParams): string {
  const delta = comparisonDelta ?? 3600;
  const suffix = thresholdSuffix ?? '';
  if (detectionType === 'dynamic') {
    return t(
      'Sentry will automatically resolve the issue when the trend goes back to baseline.'
    );
  }

  if (!conditionType || conditionValue === undefined) {
    return t('Resolution conditions not configured');
  }

  if (detectionType === 'static') {
    if (conditionType === DataConditionType.GREATER) {
      return t(
        'Issue will be resolved when the query value is less than %s%s.',
        conditionValue,
        suffix
      );
    }
    return t(
      'Issue will be resolved when the query value is more than %s%s.',
      conditionValue,
      suffix
    );
  }

  if (detectionType === 'percent') {
    if (conditionType === DataConditionType.GREATER) {
      return t(
        'Issue will be resolved when the query value is less than %s%% higher than the previous %s.',
        conditionValue,
        getDuration(delta)
      );
    }
    return t(
      'Issue will be resolved when the query value is less than %s%% lower than the previous %s.',
      conditionValue,
      getDuration(delta)
    );
  }

  return t('Resolution conditions not configured');
}
