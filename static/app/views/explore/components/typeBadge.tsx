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
    return <Tag variant="success">{t('f(x)')}</Tag>;
  }

  if (kind === FieldKind.MEASUREMENT) {
    return <Tag variant="info">{t('number')}</Tag>;
  }

  if (kind === FieldKind.TAG) {
    return <Tag variant="warning">{t('string')}</Tag>;
  }

  return null;
}
