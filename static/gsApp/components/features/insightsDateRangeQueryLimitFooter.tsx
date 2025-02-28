import styled from '@emotion/styled';

import {Button, type ButtonProps, LinkButton} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import withOrganization from 'sentry/utils/withOrganization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import UpgradeOrTrialButton from 'getsentry/components/upgradeOrTrialButton';
import withSubscription from 'getsentry/components/withSubscription';
import {useBillingConfig} from 'getsentry/hooks/useBillingConfig';
import type {Subscription} from 'getsentry/types';

interface Props {
  organization: Organization;
  subscription: Subscription;
}

const DESCRIPTION = t(
  'To view more trends for your Performance data, upgrade to Business.'
);
const QUERY_LIMIT_REFERRER = 'insights-query-limit-footer';
const BUTTON_SIZE: ButtonProps['size'] = 'sm';

/** @internal exported for tests only */
export function InsightsDateRangeQueryLimitFooter({organization, subscription}: Props) {
  const checkoutUrl = normalizeUrl(
    `/settings/${organization.slug}/billing/checkout/?referrer=checkout-${QUERY_LIMIT_REFERRER}`
  );
  const source = QUERY_LIMIT_REFERRER;

  const canTrial = subscription.canTrial;
  const shouldShowQueryLimitFooter = useHasRequiredFeatures(organization, subscription);

  if (shouldShowQueryLimitFooter) {
    return (
      <Container>
        <DescriptionContainer>{DESCRIPTION}</DescriptionContainer>
        <ButtonContainer>
          <UpgradeOrTrialButton
            subscription={subscription}
            priority="primary"
            size={BUTTON_SIZE}
            organization={organization}
            source={source}
            aria-label="Start Trial"
          >
            {canTrial ? t('Start Trial') : t('Upgrade Now')}
          </UpgradeOrTrialButton>
          {canTrial && (
            <LinkButton size={BUTTON_SIZE} to={checkoutUrl}>
              {t('Upgrade Now')}
            </LinkButton>
          )}
          {!canTrial && (
            <Button
              size={BUTTON_SIZE}
              onClick={() =>
                openUpsellModal({
                  organization,
                  source,
                  defaultSelection: 'insights-modules',
                })
              }
            >
              {t('Learn More')}
            </Button>
          )}
        </ButtonContainer>
      </Container>
    );
  }
  return undefined;
}

const ButtonContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  padding: ${space(0.5)};
`;

const DescriptionContainer = styled('div')`
  font-size: 12px;
`;

const useHasRequiredFeatures = (
  organization: Organization,
  subscription: Subscription
) => {
  const {data: billingConfig} = useBillingConfig({organization, subscription});
  const subscriptionPlan = subscription.planDetails;
  const subscriptionPlanFeatures = subscriptionPlan?.features ?? [];

  const trialPlan = subscription.trialPlan
    ? billingConfig?.planList?.find(plan => plan.id === subscription.trialPlan)
    : undefined;
  const trialPlanFeatures = trialPlan?.features ?? [];

  const enabledFeatures = [
    ...new Set([
      ...subscriptionPlanFeatures,
      ...trialPlanFeatures,
      ...organization.features,
    ]),
  ];
  return enabledFeatures.includes('insights-query-date-range-limit');
};

export default withOrganization(
  withSubscription(InsightsDateRangeQueryLimitFooter, {noLoader: true})
);
