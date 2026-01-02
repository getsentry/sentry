import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {Button} from 'sentry/components/core/button';
import Panel from 'sentry/components/panels/panel';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import AddEventsCTA from 'getsentry/components/addEventsCTA';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {
  getBestActionToIncreaseEventLimits,
  hasPerformance,
} from 'getsentry/utils/billing';
import {ButtonWrapper, SubscriptionBody} from 'getsentry/views/subscriptionPage/styles';
import TrialBadge from 'getsentry/views/subscriptionPage/trial/badge';

type Props = {
  organization: Organization;
  subscription: Subscription;
  referrer?: string;
};

function OrgStatsBanner({organization, subscription, referrer}: Props) {
  if (!subscription.canSelfServe || !hasPerformance(subscription.planDetails)) {
    return null;
  }

  referrer = referrer || 'org-stats';

  const props = {
    organization,
    subscription,
    referrer,
    source: referrer,
    buttonProps: {
      size: 'sm' as const,
    },
  };
  const isPaidPlan = subscription.planDetails.price > 0;
  // only show start trial if on a free plan and trial available
  const showStartTrial = !isPaidPlan && subscription.canTrial;
  const getTextContent = (): [string, string | React.JSX.Element] => {
    const action = getBestActionToIncreaseEventLimits(organization, subscription);
    switch (action) {
      case 'start_trial':
        return [
          t('Try Sentry Business for Free'),
          t("Activate your trial to take advantage of Sentry's Business plan features."),
        ];
      case 'add_events':
        return [
          t('Increase your Reserved Quotas'),
          t('Increase your reserved limits, because no one likes dropped data.'),
        ];
      case 'request_add_events':
        return [
          t('Request an Increase to Reserved Limits'),
          t('Bump your Organization’s owner to bump your limits.'),
        ];
      case 'request_upgrade':
        return [
          t('Request an Upgrade to Business'),
          tct(
            '[italicized] your Organization’s owner to upgrade Sentry (See what I did there?).',
            {
              italicized: <i>{t('Bug')}</i>,
            }
          ),
        ];
      case 'send_to_checkout':
        return [
          t('Upgrade to Business'),
          t(
            'Advanced integrations, deep insights, custom dashboards, and more. Upgrade to Sentry’s Business plan today.'
          ),
        ];
      default:
        return ['', ''];
    }
  };
  const [headerText, subText] = getTextContent();
  if (!headerText && !subText) {
    return null;
  }

  return (
    <Panel>
      <SubscriptionBody withPadding>
        <TextWrapper>
          <Flex>
            <Heading>{headerText}</Heading>
            {showStartTrial && (
              <TrialBadge subscription={subscription} organization={organization} />
            )}
          </Flex>
          <SubText>{subText}</SubText>
        </TextWrapper>
        <ButtonWrapper>
          {!isPaidPlan && (
            <Button
              size="sm"
              onClick={() =>
                openUpsellModal({organization, source: `${referrer}.banner`})
              }
            >
              {t('Learn More')}
            </Button>
          )}
          <AddEventsCTA {...props} />
        </ButtonWrapper>
      </SubscriptionBody>
    </Panel>
  );
}

const Heading = styled('span')`
  font-weight: 400;
  font-size: ${p => p.theme.fontSize.xl};
  margin-right: ${space(1)};
`;

const SubText = styled(TextBlock)`
  color: ${p => p.theme.subText};
  margin: 0;
`;

const TextWrapper = styled('div')`
  display: grid;
  grid-auto-rows: auto;
  gap: ${space(1)};
`;

export default withSubscription(OrgStatsBanner, {noLoader: true});
