import BadgeTag from 'sentry/components/badge/tag';
import {t} from 'sentry/locale';
import type {Tag} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';

interface TypeBadgeProps {
  tag?: Tag;
}

export function TypeBadge({tag}: TypeBadgeProps) {
  if (tag?.kind === FieldKind.MEASUREMENT) {
    return <BadgeTag type="success">{t('number')}</BadgeTag>;
  }
  if (tag?.kind === FieldKind.TAG) {
    return <BadgeTag type="highlight">{t('string')}</BadgeTag>;
  }
  return null;
}
