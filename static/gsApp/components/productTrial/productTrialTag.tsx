import {Tag, type TagProps} from '@sentry/scraps/badge';

import {IconBusiness} from 'sentry/icons';
import {IconClock} from 'sentry/icons/iconClock';
import {IconFlag} from 'sentry/icons/iconFlag';
import {t} from 'sentry/locale';
import {getDaysSinceDate} from 'sentry/utils/getDaysSinceDate';

import type {ProductTrial} from 'getsentry/types';

interface ProductTrialTagProps {
  trial: ProductTrial;
  showTrialEnded?: boolean;
  variant?: TagProps['variant'];
}

export function ProductTrialTag({
  trial,
  variant,
  showTrialEnded = false,
}: ProductTrialTagProps) {
  const daysLeft = -1 * getDaysSinceDate(trial.endDate ?? '');

  if (daysLeft < 0) {
    if (!showTrialEnded) {
      return null;
    }

    return (
      <Tag icon={<IconFlag />} variant={variant ?? 'muted'}>
        {t('Trial ended')}
      </Tag>
    );
  }

  if (!trial.isStarted) {
    return (
      <Tag icon={<IconBusiness />} variant={variant ?? 'promotion'}>
        {t('Trial available')}
      </Tag>
    );
  }

  return (
    <Tag icon={<IconClock />} variant={variant ?? (daysLeft <= 7 ? 'warning' : 'info')}>
      {t('%d days left', daysLeft)}
    </Tag>
  );
}
