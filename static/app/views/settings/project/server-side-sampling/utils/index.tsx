import round from 'lodash/round';

import {t} from 'sentry/locale';
import {SamplingInnerName, SamplingRule, SamplingRuleType} from 'sentry/types/sampling';
import {defined} from 'sentry/utils';

// TODO: Update this link as soon as we have one for sampling
export const SERVER_SIDE_SAMPLING_DOC_LINK =
  'https://docs.sentry.io/product/data-management-settings/filtering/';

export function getInnerNameLabel(name: SamplingInnerName | string) {
  switch (name) {
    case SamplingInnerName.TRACE_ENVIRONMENT:
      return t('Environment');
    case SamplingInnerName.TRACE_RELEASE:
      return t('Release');
    case SamplingInnerName.TRACE_USER_SEGMENT:
      return t('User Segment');
    default:
      return '';
  }
}

export const quantityField = 'sum(quantity)';

export function isUniformRule(rule?: SamplingRule) {
  if (!rule) {
    return false;
  }

  return rule.type === SamplingRuleType.TRACE && rule.condition.inner.length === 0;
}

export function isValidSampleRate(sampleRate: number | undefined) {
  if (!defined(sampleRate)) {
    return false;
  }

  return !isNaN(sampleRate) && sampleRate <= 100 && sampleRate >= 0;
}

export function rateToPercentage(rate: number | undefined, decimalPlaces: number = 2) {
  if (!defined(rate)) {
    return rate;
  }

  return round(rate * 100, decimalPlaces);
}

export function percentageToRate(rate: number | undefined, decimalPlaces: number = 4) {
  if (!defined(rate)) {
    return rate;
  }

  return round(rate / 100, decimalPlaces);
}
