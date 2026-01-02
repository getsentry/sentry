import {Tag} from 'sentry/components/core/badge/tag';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import type {ParsedFunction} from 'sentry/utils/discover/fields';
import {FieldKind, FieldValueType} from 'sentry/utils/fields';

interface TypeBadgeProps {
  func?: ParsedFunction;
  isLogicFilter?: boolean;
  kind?: FieldKind;
  valueType?: FieldValueType;
}

export function TypeBadge({func, kind, valueType, isLogicFilter}: TypeBadgeProps) {
  if (defined(func) || kind === FieldKind.FUNCTION) {
    return <Tag variant="success">{t('f(x)')}</Tag>;
  }

  if (valueType === FieldValueType.BOOLEAN) {
    return <Tag variant="muted">{t('boolean')}</Tag>;
  }

  if (valueType === FieldValueType.DATE) {
    return <Tag variant="warning">{t('date')}</Tag>;
  }

  if (valueType === FieldValueType.DURATION) {
    return <Tag variant="danger">{t('duration')}</Tag>;
  }

  if (valueType === FieldValueType.INTEGER) {
    return <Tag variant="info">{t('integer')}</Tag>;
  }

  if (valueType === FieldValueType.PERCENTAGE) {
    return <Tag variant="promotion">{t('percentage')}</Tag>;
  }

  if (valueType === FieldValueType.SIZE) {
    return <Tag variant="muted">{t('size')}</Tag>;
  }

  if (valueType === FieldValueType.RATE) {
    return <Tag variant="warning">{t('rate')}</Tag>;
  }

  if (valueType === FieldValueType.PERCENT_CHANGE) {
    return <Tag variant="danger">{t('percent change')}</Tag>;
  }

  if (valueType === FieldValueType.SCORE) {
    return <Tag variant="info">{t('score')}</Tag>;
  }

  if (valueType === FieldValueType.CURRENCY) {
    return <Tag variant="success">{t('currency')}</Tag>;
  }

  if (valueType === FieldValueType.NUMBER || kind === FieldKind.MEASUREMENT) {
    return <Tag variant="info">{t('number')}</Tag>;
  }

  if (valueType === FieldValueType.STRING || kind === FieldKind.TAG) {
    return <Tag variant="warning">{t('string')}</Tag>;
  }

  if (isLogicFilter) {
    return <Tag variant="promotion">{t('logic')}</Tag>;
  }

  return null;
}
