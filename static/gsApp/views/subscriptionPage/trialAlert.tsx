import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid} from '@sentry/scraps/layout';

import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {TextBlock} from 'sentry/views/settings/components/text/textBlock';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import type {Subscription} from 'getsentry/types';
import {getTrialDaysLeft, isTrial} from 'getsentry/utils/billing';

import {TrialBadge} from './trial/badge';
import {ButtonWrapper, SubscriptionBody} from './styles';

type Props = {
  organization: Organization;
  subscription: Subscription;
};

export function TrialAlert({organization, subscription}: Props) {
  if (!isTrial(subscription)) {
    return null;
  }

  const daysLeft = getTrialDaysLeft(subscription);

  if (daysLeft < 0) {
    return null;
  }

  const trialName = subscription.isEnterpriseTrial
    ? t('Enterprise Trial')
    : t('Business Plan Trial');

  const trialType = subscription.isEnterpriseTrial ? t('Enterprise') : t('Business');
  const trialEndDate = moment(subscription.trialEnd).utc().format('MMM D, YYYY');

  return (
    <Container
      data-test-id="trial-alert"
      background="primary"
      border="primary"
      radius="md"
    >
      <SubscriptionBody>
        <Grid gap="md" autoRows="auto">
          <Flex align="center" gap="md">
            <StyledHeading>{trialName}</StyledHeading>
            <TrialBadge subscription={subscription} organization={organization} />
          </Flex>
          <StyledSubText>
            {tct(
              'Your [trialType] trial is separate from your plan and stays active until [trialEndDate].',
              {trialType, trialEndDate}
            )}
          </StyledSubText>
        </Grid>

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

const StyledHeading = styled('span')`
  font-weight: 400;
  font-size: ${p => p.theme.font.size.xl};
`;

const StyledSubText = styled(TextBlock)`
  color: ${p => p.theme.tokens.content.secondary};
  margin: 0;
`;
