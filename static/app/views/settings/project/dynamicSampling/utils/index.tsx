import round from 'lodash/round';

import {t} from 'sentry/locale';
import {SamplingInnerName, SamplingRule, SamplingRuleType} from 'sentry/types/sampling';
import {defined} from 'sentry/utils';

export const SERVER_SIDE_SAMPLING_DOC_LINK =
  'https://docs.sentry.io/product/data-management-settings/dynamic-sampling/';

export function getInnerNameLabel(name: SamplingInnerName) {
  switch (name) {
    case SamplingInnerName.TRACE_ENVIRONMENT:
      return t('Environment');
    case SamplingInnerName.TRACE_RELEASE:
      return t('Release');
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

export function isValidSampleRate(
  floorRate: number | undefined,
  sampleRate: number | undefined
) {
  if (!defined(sampleRate) || !defined(floorRate)) {
    return false;
  }

  return (
    !isNaN(sampleRate) && !isNaN(floorRate) && sampleRate >= floorRate && sampleRate <= 1
  );
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
