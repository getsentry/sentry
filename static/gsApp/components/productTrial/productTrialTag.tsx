import moment from 'moment-timezone';

import {Tag, type TagProps} from 'sentry/components/core/badge/tag';
import {IconBusiness} from 'sentry/icons';
import {IconClock} from 'sentry/icons/iconClock';
import {IconFlag} from 'sentry/icons/iconFlag';
import {t} from 'sentry/locale';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';

import type {ProductTrial} from 'getsentry/types';

interface ProductTrialTagProps {
  trial: ProductTrial;
  showTrialEnded?: boolean;
  variant?: TagProps['variant'];
}

function ProductTrialTag({trial, variant, showTrialEnded = false}: ProductTrialTagProps) {
  const now = moment();

  if (moment(trial.endDate).add(1, 'days').isBefore(now)) {
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

  const daysLeft = -1 * getDaysSinceDate(trial.endDate ?? '');

  return (
    <Tag icon={<IconClock />} variant={variant ?? (daysLeft <= 7 ? 'warning' : 'info')}>
      {t('%d days left', daysLeft)}
    </Tag>
  );
}

export default ProductTrialTag;
