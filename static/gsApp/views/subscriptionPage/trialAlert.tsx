import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import type {Subscription} from 'getsentry/types';
import {getTrialDaysLeft} from 'getsentry/utils/billing';

import TrialBadge from './trial/badge';
import {ButtonWrapper, SubscriptionBody} from './styles';

type Props = {
  organization: Organization;
  subscription: Subscription;
};

function TrialAlert({organization, subscription}: Props) {
  if (!subscription.isTrial) {
    return null;
  }

  const daysLeft = getTrialDaysLeft(subscription);

  if (daysLeft < 0) {
    return null;
  }

  const trialName = subscription.isEnterpriseTrial
    ? t('Enterprise Trial')
    : subscription.isPerformancePlanTrial
      ? t('Performance Trial')
      : t('Business Plan Trial');

  const featuresName = subscription.isPerformancePlanTrial
    ? 'performance'
    : 'business plan';

  return (
    <Container
      data-test-id="trial-alert"
      background="primary"
      border="primary"
      radius="md"
    >
      <SubscriptionBody withPadding>
        <TrialInfo>
          <Flex align="center" gap="md">
            <StyledHeading>{trialName}</StyledHeading>
            <TrialBadge subscription={subscription} organization={organization} />
          </Flex>
          <Text as="div" density="comfortable" variant="muted">
            {tct("With your trial you have access to Sentry's [featuresName] features.", {
              featuresName,
            })}
          </Text>
        </TrialInfo>

        {subscription.canSelfServe && (
          <ButtonWrapper gap="0">
            <Button
              size="sm"
              data-test-id="trial-details-button"
              onClick={() => openUpsellModal({organization, source: 'active_trial'})}
            >
              {t('Learn more')}
            </Button>
          </ButtonWrapper>
        )}
      </SubscriptionBody>
    </Container>
  );
}

const TrialInfo = styled('div')`
  display: grid;
  grid-auto-rows: auto;
  gap: ${space(1)};
`;

const StyledHeading = styled('span')`
  font-weight: 400;
  font-size: ${p => p.theme.font.size.xl};
`;

export default TrialAlert;
