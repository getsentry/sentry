import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconBusiness, IconCheckmark, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {OrganizationContext} from 'sentry/views/organizationContext';

import TrialStarter from 'getsentry/components/trialStarter';
import UpgradeOrTrialButton from 'getsentry/components/upgradeOrTrialButton';
import type {Subscription} from 'getsentry/types';
import {getTrialLength, hasJustStartedPlanTrial} from 'getsentry/utils/billing';

import withSubscription from './withSubscription';

type MemberInviteProps = {
  children: (opts: {
    canSend: boolean;
    isOverMemberLimit: boolean;
    sendInvites: () => void;
    headerInfo?: React.ReactNode;
  }) => React.ReactElement;
  onSendInvites: () => void;
  organization: Organization;
  subscription: Subscription;
  willInvite: boolean;
};

function MemberInviteModalCustomization({
  organization,
  willInvite,
  onSendInvites,
  children,
  subscription,
}: MemberInviteProps) {
  const {totalMembers, canTrial, isTrial, totalLicenses} = subscription;
  const usedSeats = totalMembers ?? 0;
  const isOverMemberLimit: boolean = totalLicenses > 0 && usedSeats >= totalLicenses;

  const renderPassthrough = () =>
    children({
      sendInvites: onSendInvites,
      canSend: true,
      isOverMemberLimit,
    });

  // We don't need to do anything if the modal isn't going to actually sent
  // member invites.
  if (!willInvite) {
    return renderPassthrough();
  }

  type RenderProps = Parameters<React.ComponentProps<typeof TrialStarter>['children']>[0];

  const trialStarterRenderer = ({
    trialStarting,
    trialStarted,
    trialFailed,
  }: RenderProps) => {
    // maxMembers is null for paid plans
    const hasSeats = !totalLicenses || usedSeats < totalLicenses;

    // If we just started the trial continue rendering the trial banner in the modal header.
    if (!(hasJustStartedPlanTrial(subscription) && trialStarted) && hasSeats) {
      return renderPassthrough();
    }

    const allowedToStartTrial = organization.access.includes('org:billing');
    const isExpired = !canTrial && !isTrial;
    const trialLength = getTrialLength(organization);

    const trialStartText = t('Start your %s day Business Plan trial today!', trialLength);

    const upgradeOrTrialButton = (
      <UpgradeOrTrialButton
        source="member_invite_modal"
        subscription={subscription}
        organization={organization}
        upgradePriority="default"
      />
    );

    function getHeaderInfo() {
      if (isOverMemberLimit) {
        return (
          <TrialInfo status="error">
            <IconWarning />
            {tct(
              'You have reached your [totalLicenses] member limit. Upgrade to invite more members.',
              {totalLicenses}
            )}
            {upgradeOrTrialButton}
          </TrialInfo>
        );
      }
      // hasJustStartedPlanTrial based on isTrial (plan is a trial plan) and isTrialStarted which comes from updating the subscription after a trial, trialStarted comes from the trial starter widget
      if (hasJustStartedPlanTrial(subscription) || trialStarted) {
        return (
          <TrialInfo status="success">
            <IconCheckmark />
            {t('Your %s day Business Plan Trial has been activated!', trialLength)}
          </TrialInfo>
        );
      }
      if (isExpired) {
        return (
          <TrialInfo status="error">
            <IconWarning />
            {t(
              'Your %s day Business Plan Trial has expired. Upgrade to invite more members.',
              trialLength
            )}
            {upgradeOrTrialButton}
          </TrialInfo>
        );
      }
      if (trialStarting) {
        return (
          <TrialInfo>
            <LoadingIndicator mini relative hideMessage size={16} />
            {trialStartText}
          </TrialInfo>
        );
      }
      if (trialFailed) {
        return (
          <TrialInfo status="error">
            <IconWarning />
            {tct(
              `There was a problem starting your trial. Check your
           [settings:subscription settings].`,
              {settings: <Link to={`/settings/${organization.slug}/billing/`} />}
            )}
          </TrialInfo>
        );
      }
      if (!allowedToStartTrial) {
        return (
          <TrialInfo status="error">
            <IconWarning />
            {t(
              `You do not have permission to upgrade or start a trial to invite
           members. Contact your organization owner or billing manager.`
            )}
            {upgradeOrTrialButton}
          </TrialInfo>
        );
      }
      return (
        <TrialInfo>
          <IconBusiness gradient withShine size="md" />
          {trialStartText}
          {upgradeOrTrialButton}
        </TrialInfo>
      );
    }

    return children({
      headerInfo: getHeaderInfo(),
      canSend: true,
      sendInvites: onSendInvites,
      isOverMemberLimit,
    });
  };

  return (
    <TrialStarter
      organization={organization}
      source="invite_modal"
      onTrialStarted={onSendInvites}
    >
      {trialStarterRenderer}
    </TrialStarter>
  );
}

const TrialInfo = styled('div')<{status?: string}>`
  display: grid;
  min-height: 50px;
  grid-template-columns: 20px 1fr max-content;
  gap: ${space(1.5)};
  padding: ${space(1.5)};
  margin: ${space(2)} 0;
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: 3px;
  ${p => p.status === 'error' && `color: ${p.theme.red300}`};

  > :first-child {
    justify-self: center;
    ${p => p.status === 'success' && `color: ${p.theme.green300}`};
  }
`;

// wraps the component to add the organization context
function MemberInviteModalCustomizationWrapper(props: MemberInviteProps) {
  return (
    <OrganizationContext.Provider value={props.organization}>
      <MemberInviteModalCustomization {...props} />
    </OrganizationContext.Provider>
  );
}

export default withSubscription(MemberInviteModalCustomizationWrapper);
