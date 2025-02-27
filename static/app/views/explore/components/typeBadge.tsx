import BadgeTag from 'sentry/components/core/badge/tag';
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
    return <BadgeTag type="warning">{t('aggregation')}</BadgeTag>;
  }

  if (kind === FieldKind.MEASUREMENT) {
    return <BadgeTag type="success">{t('number')}</BadgeTag>;
  }

  if (kind === FieldKind.TAG) {
    return <BadgeTag type="highlight">{t('string')}</BadgeTag>;
  }

  return null;
}
