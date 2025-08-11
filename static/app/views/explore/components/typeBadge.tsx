import {Tag} from 'sentry/components/core/badge/tag';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import type {ParsedFunction} from 'sentry/utils/discover/fields';
import {FieldKind} from 'sentry/utils/fields';

interface TypeBadgeProps {
  func?: ParsedFunction;
  kind?: FieldKind;
}

export function TypeBadge({func, kind}: TypeBadgeProps) {
  if (defined(func) || kind === FieldKind.FUNCTION) {
    return <Tag type="success">{t('f(x)')}</Tag>;
  }

  if (kind === FieldKind.MEASUREMENT) {
    return <Tag type="highlight">{t('number')}</Tag>;
  }

  if (kind === FieldKind.TAG) {
    return <Tag type="warning">{t('string')}</Tag>;
  }

  return null;
}
