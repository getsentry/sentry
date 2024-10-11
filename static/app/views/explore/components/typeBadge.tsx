import BadgeTag from 'sentry/components/badge/tag';
import {t} from 'sentry/locale';
import type {Tag} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import type {ParsedFunction} from 'sentry/utils/discover/fields';
import {FieldKind} from 'sentry/utils/fields';

interface TypeBadgeProps {
  func?: ParsedFunction;
  tag?: Tag;
}

export function TypeBadge({func, tag}: TypeBadgeProps) {
  if (defined(func)) {
    return <BadgeTag type="warning">{t('aggregation')}</BadgeTag>;
  }

  if (tag?.kind === FieldKind.MEASUREMENT) {
    return <BadgeTag type="success">{t('number')}</BadgeTag>;
  }
  if (tag?.kind === FieldKind.TAG) {
    return <BadgeTag type="highlight">{t('string')}</BadgeTag>;
  }
  return null;
}
