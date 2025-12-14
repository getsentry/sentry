import styled from '@emotion/styled';

import {Radio} from 'sentry/components/core/radio';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import useRouter from 'sentry/utils/useRouter';

import type {Subscription} from 'getsentry/types';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import {shouldSeeSpendVisibility} from 'getsentry/views/subscriptionPage/utils';

interface DisplayModeToggleProps {
  displayMode: 'cost' | 'usage';
  organization: Organization;
  subscription: Subscription;
}

export function DisplayModeToggle({
  subscription,
  displayMode,
  organization,
}: DisplayModeToggleProps) {
  const router = useRouter();
  if (!shouldSeeSpendVisibility(subscription)) {
    return null;
  }

  function onDisplayModeChange(mode: 'cost' | 'usage') {
    router.push({
      pathname: router.location.pathname,
      query: {
        ...router.location.query,
        displayMode: mode,
      },
    });

    trackGetsentryAnalytics('subscription_page.display_mode.changed', {
      display_mode: mode,
      subscription,
      organization,
    });
  }

  return (
    <SpendToggleWrapper>
      {t('Display mode')}:
      <RadioLabel>
        <Radio
          aria-label={t('Usage')}
          checked={displayMode === 'usage'}
          onChange={() => onDisplayModeChange('usage')}
          size="sm"
        />
        {t('Usage')}
      </RadioLabel>
      <RadioLabel>
        <Radio
          aria-label={t('Spend')}
          checked={displayMode === 'cost'}
          onChange={() => onDisplayModeChange('cost')}
          size="sm"
        />
        {t('Spend')}
      </RadioLabel>
    </SpendToggleWrapper>
  );
}

const SpendToggleWrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const RadioLabel = styled('label')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  cursor: pointer;
  font-weight: normal;
  margin-bottom: 0;
`;
