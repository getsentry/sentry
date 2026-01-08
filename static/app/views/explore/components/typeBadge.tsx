import {Text} from '@sentry/scraps/text';

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
    return <Text variant="success">{t('f(x)')}</Text>;
  }

  if (valueType === FieldValueType.BOOLEAN) {
    return <Text variant="promotion">{t('boolean')}</Text>;
  }

  if (valueType === FieldValueType.DATE) {
    return <Text variant="danger">{t('date')}</Text>;
  }

  if (valueType === FieldValueType.DURATION) {
    return <Text variant="danger">{t('duration')}</Text>;
  }

  if (valueType === FieldValueType.INTEGER) {
    return <Text variant="accent">{t('integer')}</Text>;
  }

  if (valueType === FieldValueType.PERCENTAGE) {
    return <Text variant="promotion">{t('percentage')}</Text>;
  }

  if (valueType === FieldValueType.SIZE) {
    return <Text variant="success">{t('size')}</Text>;
  }

  if (valueType === FieldValueType.RATE) {
    return <Text variant="warning">{t('rate')}</Text>;
  }

  if (valueType === FieldValueType.PERCENT_CHANGE) {
    return <Text variant="danger">{t('percent change')}</Text>;
  }

  if (valueType === FieldValueType.SCORE) {
    return <Text variant="accent">{t('score')}</Text>;
  }

  if (valueType === FieldValueType.CURRENCY) {
    return <Text variant="success">{t('currency')}</Text>;
  }

  if (valueType === FieldValueType.NUMBER || kind === FieldKind.MEASUREMENT) {
    return <Text variant="warning">{t('number')}</Text>;
  }

  if (valueType === FieldValueType.STRING || kind === FieldKind.TAG) {
    return <Text variant="accent">{t('string')}</Text>;
  }

  if (isLogicFilter) {
    return <Text variant="promotion">{t('logic')}</Text>;
  }

  return null;
}
