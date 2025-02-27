import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconBusiness, IconWarning} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

import UpgradeOrTrialButton from 'getsentry/components/upgradeOrTrialButton';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {displayPlanName, getTrialDaysLeft, isTrialPlan} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

type Props = Pick<ModalRenderProps, 'closeModal'> & {
  organization: Organization;
  subscription: Subscription;
};

function WarningItem(text: string, index: number) {
  return (
    <Fragment key={index}>
      <IconWarning size="sm" color="yellow300" />
      {text}
    </Fragment>
  );
}

function UpgradeItem(text: string, index: number) {
  return (
    <Fragment key={index}>
      <IconBusiness size="sm" gradient />
      {text}
    </Fragment>
  );
}

function TrialEndingModal({organization, subscription, closeModal}: Props) {
  const daysLeft = getTrialDaysLeft(subscription);

  if (daysLeft < 0) {
    return null;
  }

  // not a trial coming from a paid plan (ex: am1_team)
  const isFreePlanTrial = isTrialPlan(subscription.plan);

  const returnPlan = t(
    '%s Plan',
    isFreePlanTrial ? t('Developer') : displayPlanName(subscription.planDetails)
  );

  const leftColumnItems = isFreePlanTrial
    ? [
        t('Limited to one active user'),
        t('Events retained for 30 days'),
        t('Limited features & integrations'),
      ]
    : [
        t('Single project views'),
        t('Read-only dashboards'),
        t('Limited features & integrations'),
      ];

  const rightColumnItems = isFreePlanTrial
    ? [
        t('Unlimited Users'),
        t('Events retained for 90 days'),
        t('Access all features & integrations'),
      ]
    : [
        t('Cross-project visibility'),
        t('Custom queries and dashboards'),
        t('Access all features & integrations'),
      ];

  return (
    <div data-test-id="trial-ending-modal">
      <div>
        <TrialEndInfo>
          <h2 data-test-id="trial-end-header">
            {tn('Trial Ends in %s Day', 'Trial Ends in %s Days', daysLeft)}
          </h2>
          <p data-test-id="trial-end-body">
            {tct(
              `Time flies when you're squashing bugs! Unless you say otherwise, we'll switch your account back to a
              [planName] in [daysLeft]. This may impact your current workflow, see the differences below.`,
              {planName: returnPlan, daysLeft: tn('%s day', '%s days', daysLeft)}
            )}
          </p>
        </TrialEndInfo>
        <PathWrapper>
          <PathContainer>
            <PathHeading>{returnPlan}</PathHeading>
            <Bullets>{leftColumnItems.map(WarningItem)}</Bullets>

            <Button
              priority="default"
              onClick={() => {
                trackGetsentryAnalytics('trial_ended_notice.dismissed_understood', {
                  organization,
                  subscription,
                });
                closeModal();
              }}
            >
              {t('I Understand the Changes')}
            </Button>
          </PathContainer>

          <PathContainer>
            <PathHeading>{t('Keep your Business Plan')}</PathHeading>
            <Bullets>{rightColumnItems.map(UpgradeItem)}</Bullets>
            <UpgradeOrTrialButton
              source="trial_ending_modal"
              action="upgrade"
              subscription={subscription}
              organization={organization}
              onSuccess={closeModal}
            >
              {organization.access.includes('org:billing')
                ? t('Upgrade Now')
                : t('Request Upgrade')}
            </UpgradeOrTrialButton>
            <OtherPlanDetails>
              {tct("Don't need our Business Plan? [link:See other options]", {
                link: <ExternalLink href="https://sentry.io/pricing" />,
              })}
            </OtherPlanDetails>
          </PathContainer>
        </PathWrapper>
      </div>
    </div>
  );
}

const TrialEndInfo = styled('div')`
  padding: ${space(3)} 0;

  p {
    font-size: ${p => p.theme.fontSizeLarge};
    margin: 0;
  }

  h2 {
    font-size: 1.5em;
  }
`;

const PathWrapper = styled('div')`
  display: grid;
  margin: 0 -${space(4)} -${space(4)};
  grid-template-columns: 1fr 1fr;
  border-top: 1px solid ${p => p.theme.gray200};
`;

const PathContainer = styled('div')`
  padding: ${space(4)};
  display: grid;
  grid-auto-rows: max-content;
  gap: ${space(1.5)};

  &:first-of-type {
    border-right: 1px solid ${p => p.theme.gray200};
  }
`;

const Bullets = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-auto-rows: max-content;
  gap: ${space(1)} ${space(1.5)};
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(1)};
`;

const PathHeading = styled('h5')`
  font-weight: 200;
  margin-bottom: 0;
`;

const OtherPlanDetails = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1.5;
`;

export const modalCss = css`
  width: 100%;
  max-width: 680px;
`;

export default withSubscription(TrialEndingModal);
