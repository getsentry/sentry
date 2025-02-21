import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import type {Client} from 'sentry/api';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Tooltip} from 'sentry/components/tooltip';
import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';

import withSubscription from 'getsentry/components/withSubscription';
import {DEFAULT_TIER, SUPPORTED_TIERS} from 'getsentry/constants';
import type {PlanMigration, Subscription} from 'getsentry/types';
import {PlanTier} from 'getsentry/types';

const PREVIOUS_DESCRIPTION = t(
  `You still have access to the previous tier of Sentry plans. However, you'll be missing
   out on features only available on the latest plans.`
);

const LATEST_DESCRIPTION = t(
  `You are viewing the previous Sentry plans. Click to see the current tier of
   Sentry plans.`
);

type Props = {
  api: Client;
  onClick: () => void;
  organization: Organization;
  subscription: Subscription;
  /**
   * The currently selected planTier of the checkout page.
   */
  checkoutTier?: string;
};

function LegacyPlanToggle({
  onClick,
  organization,
  subscription,
  checkoutTier,
  api,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<undefined | Error | string>(undefined);
  const [planMigrations, setPlanMigrations] = useState<PlanMigration[]>([]);

  const fetchPlanMigrations = useCallback(async () => {
    if (subscription.planTier === DEFAULT_TIER) {
      return;
    }

    setIsLoading(true);
    setError(undefined);
    try {
      const response = await api.requestPromise(
        `/customers/${organization.slug}/plan-migrations/?applied=0`
      );
      setPlanMigrations(response);
      setIsLoading(false);
    } catch (err) {
      setError(err);
      Sentry.captureException(err);
      setIsLoading(false);
    }
  }, [api, organization, subscription.planTier]);

  useEffect(() => void fetchPlanMigrations(), [fetchPlanMigrations]);

  if (error) {
    return null;
  }

  if (isLoading) {
    return <LoadingIndicator mini />;
  }

  const canToggleLegacy = subscription.planTier === PlanTier.AM1;

  /**
   * Show the legacy plan toggle if:
   * 1. The subscription is paid
   * 2. The subscription is on the AM1 tier
   * 3. The subscription has no active plan migration
   */
  const showToggle =
    canToggleLegacy &&
    subscription.planDetails?.basePrice > 0 &&
    planMigrations?.length === 0;

  if (!showToggle) {
    return null;
  }

  // We only allow AM1 customers to toggle, and only between AM1 and AM2
  const onLatestPlans = checkoutTier === SUPPORTED_TIERS[1];

  return (
    <ToggleWrapper>
      <ToggleLink role="button" onClick={onClick} data-test-id="legacy-tier-toggle">
        {onLatestPlans ? t('Show previous plans') : t('Show latest plans')}
      </ToggleLink>
      <Tooltip title={onLatestPlans ? PREVIOUS_DESCRIPTION : LATEST_DESCRIPTION}>
        <IconWrapper>
          <IconInfo size="xs" />
        </IconWrapper>
      </Tooltip>
    </ToggleWrapper>
  );
}

const ToggleWrapper = styled('div')`
  display: flex;
  align-items: center;
  font-weight: normal;
  text-transform: none;
`;

const ToggleLink = styled('a')`
  margin-right: ${space(0.5)};
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};

  &:active,
  &:focus,
  &:hover {
    color: ${p => p.theme.subText};
  }
`;

const IconWrapper = styled('div')`
  display: grid;
  align-items: center;
  color: ${p => p.theme.subText};
`;

export default withApi(withOrganization(withSubscription(LegacyPlanToggle)));
