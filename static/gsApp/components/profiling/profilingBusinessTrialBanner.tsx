import {useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {BodyTitle} from 'sentry/components/updatedEmptyState';
import {IconBusiness} from 'sentry/icons/iconBusiness';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import {getProfileDurationCategoryForPlatform} from 'sentry/utils/profiling/platforms';
import useOrganization from 'sentry/utils/useOrganization';

import StartTrialButton from 'getsentry/components/startTrialButton';
import useSubscription from 'getsentry/hooks/useSubscription';
import {hasBudgetFor} from 'getsentry/utils/profiling';

interface ContinuousProfilingBusinessTrialBannerProps {
  project: Project;
}

export function ContinuousProfilingBusinessTrialBanner({
  project,
}: ContinuousProfilingBusinessTrialBannerProps) {
  const [isStartingTrial, setIsStartingTrial] = useState(false);

  const organization = useOrganization();
  const subscription = useSubscription();

  // Already used up their business trial
  if (!subscription?.canTrial) {
    return null;
  }

  const dataCategory = getProfileDurationCategoryForPlatform(project.platform);

  // Profiling not supported for this platform
  if (!dataCategory) {
    return null;
  }

  if (hasBudgetFor(subscription, dataCategory)) {
    return null;
  }

  return (
    <Alert.Container>
      <Alert type="muted" showIcon={false}>
        <BodyTitle>{t('Start free Business plan trial')}</BodyTitle>
        <UpgradePrompt>
          {tct(
            'Want to give [dataCategory] a test drive without paying? Start a Business plan trial, free for 14 days.',
            {
              dataCategory:
                dataCategory === DataCategory.PROFILE_DURATION
                  ? t('Continuous Profiling')
                  : t('UI Profiling'),
            }
          )}
        </UpgradePrompt>
        <StartTrialButton
          organization={organization}
          source="alert-profiling-product-trials"
          aria-label={t('Start trial')}
          priority="primary"
          handleClick={() => setIsStartingTrial(true)}
          onTrialStarted={() => setIsStartingTrial(true)}
          onTrialFailed={() => setIsStartingTrial(false)}
          busy={isStartingTrial}
          disabled={isStartingTrial}
        >
          <StyledIconBusiness />
          {t('Start Trial')}
        </StartTrialButton>
      </Alert>
    </Alert.Container>
  );
}

const UpgradePrompt = styled('div')`
  margin-bottom: ${p => p.theme.space.md};
`;

const StyledIconBusiness = styled(IconBusiness)`
  margin-bottom: ${p => p.theme.space.xs};
`;
