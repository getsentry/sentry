import {Tag} from '@sentry/scraps/badge';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

import type {ServiceAccount} from './types';

export function ServiceAccountOwnerKind({
  ownerKind,
}: {
  ownerKind: ServiceAccount['ownerKind'];
}) {
  switch (ownerKind) {
    case 'organization':
      return <Text>{t('Organization')}</Text>;
    case 'seer_workflow_config':
      return <Tag variant="muted">{t('Seer automation')}</Tag>;
    default:
      return <Text variant="muted">{t('Unknown')}</Text>;
  }
}
