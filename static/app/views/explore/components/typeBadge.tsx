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
  if (defined(func)) {
    return <Tag type="warning">{t('aggregation')}</Tag>;
  }

  if (kind === FieldKind.MEASUREMENT) {
    return <Tag type="success">{t('number')}</Tag>;
  }

  if (kind === FieldKind.TAG) {
    return <Tag type="highlight">{t('string')}</Tag>;
  }

  return null;
}
