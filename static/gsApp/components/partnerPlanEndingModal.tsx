import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import partnerMigrationHero from 'getsentry-images/partnership/plan-ending.svg';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Tag from 'sentry/components/badge/tag';
import {Button, LinkButton} from 'sentry/components/button';
import {IconBusiness} from 'sentry/icons';
import {IconClock} from 'sentry/icons/iconClock';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {getContractDaysLeft, isTeamPlanFamily} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

type Props = Pick<ModalRenderProps, 'closeModal'> & {
  organization: Organization;
  subscription: Subscription;
};

function DeveloperItem(text: string, index: number) {
  return (
    <Fragment key={index}>
      <div>-</div>
      {text}
    </Fragment>
  );
}

function UpgradeItem(text: string, index: number) {
  return (
    <Fragment key={index}>
      <IconBusiness size="sm" />
      {text}
    </Fragment>
  );
}

function PartnerPlanEndingModal({organization, subscription, closeModal}: Props) {
  const daysLeft = getContractDaysLeft(subscription);
  const partnerName = subscription.partner?.partnership.displayName;
  const api = new Client();
  const endpoint = `/organizations/${organization.slug}/partner-migration-request/?referrer=partner_plan_ending_modal`;

  const handleRequest = () => {
    api.request(endpoint, {
      method: 'POST',
      success: () => {
        addSuccessMessage(t('Request sent.'));
        closeModal();
      },
      error: () => {
        addErrorMessage(t('Could not send request'));
      },
    });
  };

  if (daysLeft < 0) {
    closeModal();
    return null;
  }

  const isTeam = isTeamPlanFamily(subscription.planDetails);
  const hasBillingAccess = organization.access?.includes('org:billing');

  const endDate = moment(subscription.contractPeriodEnd).add(1, 'days').format('ll');
  const lastDay = daysLeft === 0;

  const returnPlan = isTeam ? t('Team') : t('Business');

  const leftColumnItems = [
    t('One user'),
    t('Error monitoring and tracing'),
    t('Email only notifications'),
  ];

  const rightColumnItems = isTeam
    ? [
        t('Unlimited users'),
        t('Event volume controls'),
        t('SSO via Google and Github'),
        t('Third party integrations'),
        t('Extended data retention'),
        t('Custom alerts'),
        t('And more…'),
      ]
    : [
        t('Unlimited users'),
        t('Application Insights'),
        t('Advanced event volume controls'),
        t('Custom dashboards'),
        t('SAML2 & SCIM'),
        t('Third party integrations'),
        t('Extended data retention'),
        t('And more…'),
      ];

  return (
    <div data-test-id="partner-plan-ending-modal">
      <ImageHeader />
      <div>
        <PartnerPlanHeading>
          <Tag icon={<IconClock />} type={'promotion'}>
            {tn('%s day left', '%s days left', daysLeft)}
          </Tag>
          <h2 data-test-id="partner-plan-ending-header">
            {tct(`Your promotional plan with [partnerName] ends soon`, {
              partnerName,
            })}
          </h2>
          <p data-test-id="partner-plan-ending-body">
            {tct(
              `
              Your Sentry promotional plan with [partnerName] ends
              [date]. To keep full functionality, upgrade to stay on your [planName] plan.
              `,
              {
                partnerName,
                date: lastDay
                  ? 'today'
                  : `on ${moment(subscription.contractPeriodEnd).format('ll')}`,
                planName: returnPlan,
              }
            )}
          </p>
        </PartnerPlanHeading>
        <PathWrapper>
          <PathContainer>
            <SubHeading>{tct(`New Plan on [endDate]`, {endDate})}</SubHeading>
            <PathHeading>{t('Developer')}</PathHeading>
            <p>{t('For solo devs working on small projects')}</p>
            <Bullets>{leftColumnItems.map(DeveloperItem)}</Bullets>
          </PathContainer>

          <PathContainer>
            <SubHeading>{t('Recommended Plan')}</SubHeading>
            <PathHeading>{tct(`[returnPlan]`, {returnPlan})}</PathHeading>
            <p>{t('For multiple teams that operate at scale')}</p>
            <Bullets data-test-id="partner-plan-ending-bullet">
              {rightColumnItems.map(UpgradeItem)}
            </Bullets>
          </PathContainer>
        </PathWrapper>
        <div style={{display: 'block'}}>
          <StyledButtonBar>
            <Button data-test-id="maybe-later" priority={'default'} onClick={closeModal}>
              {t('Remind Me Later')}
            </Button>
            {hasBillingAccess ? (
              <LinkButton
                size="md"
                to={`/settings/${organization.slug}/billing/checkout/?referrer=partner_plan_ending_modal`}
                aria-label="Upgrade Now"
                priority="primary"
                onClick={() =>
                  trackGetsentryAnalytics('partner_billing_migration.modal.clicked_cta', {
                    subscription,
                    organization,
                    daysLeft,
                    partner: subscription.partner?.partnership.id,
                  })
                }
              >
                {t('Upgrade Now')}
              </LinkButton>
            ) : (
              <Button
                size="md"
                aria-label="Request to Upgrade"
                priority="primary"
                onClick={handleRequest}
              >
                {t('Request to Upgrade')}
              </Button>
            )}
          </StyledButtonBar>
        </div>
      </div>
    </div>
  );
}

const PartnerPlanHeading = styled('div')`
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
  display: flex;
  justify-content: space-between;
`;

const PathContainer = styled('div')`
  padding: ${space(3)};
  grid-auto-rows: max-content;
  border: 1px solid ${p => p.theme.gray300};
  margin-left: auto;
  margin-right: auto;
  border-radius: 5px;
  width: 250px;

  &:first-of-type {
    border: 1px solid ${p => p.theme.gray100};
  }
`;

const StyledButtonBar = styled('div')`
  margin-top: ${space(2)};
  display: flex;
  flex-direction: row;
  column-gap: 20px;
  text-align: right;
  justify-content: right;
`;

const ImageHeader = styled('div')`
  margin: -${space(4)} -${space(4)} 0 -${space(4)};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  background-image: url(${partnerMigrationHero});
  background-size: cover;
  background-repeat: no-repeat;
  background-position: top;
  height: 200px;

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    margin: -${space(4)} -${space(4)} 0 -${space(4)};
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
  font-weight: bold;
  margin-bottom: 0;
`;

const SubHeading = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray300};
  text-transform: uppercase;
`;

export const modalCss = css`
  width: 100%;
  max-width: 630px;
`;

export default withSubscription(PartnerPlanEndingModal);
