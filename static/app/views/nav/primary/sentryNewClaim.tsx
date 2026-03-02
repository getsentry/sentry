import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {IconClock, IconStar} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {SidebarButton} from 'sentry/views/nav/primary/components';
import {
  PrimaryButtonOverlay,
  usePrimaryButtonOverlay,
} from 'sentry/views/nav/primary/primaryButtonOverlay';

interface SentryNewOrgData {
  createdAt: Date | null;
  daysRemaining: number;
  expiresAt: Date | null;
  hoursRemaining: number;
  isClaimed: boolean;
  isExpired: boolean;
  isSentryNew: boolean;
  minutesRemaining: number;
}

function calculateTimeRemaining(expiresAt: string | null): SentryNewOrgData {
  if (!expiresAt) {
    return {
      isSentryNew: false,
      isClaimed: false,
      isExpired: false,
      expiresAt: null,
      createdAt: null,
      hoursRemaining: 0,
      minutesRemaining: 0,
      daysRemaining: 0,
    };
  }

  const expirationTime = new Date(expiresAt);
  const now = new Date();
  const diffMs = expirationTime.getTime() - now.getTime();

  if (diffMs <= 0) {
    return {
      isSentryNew: true,
      isClaimed: false,
      isExpired: true,
      expiresAt: expirationTime,
      createdAt: null,
      hoursRemaining: 0,
      minutesRemaining: 0,
      daysRemaining: 0,
    };
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  return {
    isSentryNew: true,
    isClaimed: false,
    isExpired: false,
    expiresAt: expirationTime,
    createdAt: null,
    hoursRemaining: hours,
    minutesRemaining: minutes,
    daysRemaining: days,
  };
}

function CountdownIcon({data}: {data: SentryNewOrgData}) {
  const {daysRemaining, hoursRemaining, minutesRemaining} = data;

  let displayValue: string;
  let urgency: 'critical' | 'warning' | 'info';

  if (daysRemaining > 0) {
    displayValue = `${daysRemaining}d`;
    urgency = 'info';
  } else if (hoursRemaining > 0) {
    displayValue = `${hoursRemaining}h`;
    urgency = hoursRemaining <= 6 ? 'warning' : 'info';
  } else {
    displayValue = `${minutesRemaining}m`;
    urgency = minutesRemaining <= 15 ? 'critical' : 'warning';
  }

  return (
    <CountdownContainer urgency={urgency}>
      <CountdownCircle urgency={urgency}>
        <CountdownText urgency={urgency}>{displayValue}</CountdownText>
      </CountdownCircle>
    </CountdownContainer>
  );
}

function SentryNewClaimContent({organization}: {organization: Organization}) {
  const api = useApi();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orgData, setOrgData] = useState<SentryNewOrgData>({
    isSentryNew: false,
    isClaimed: false,
    isExpired: false,
    expiresAt: null,
    createdAt: null,
    hoursRemaining: 0,
    minutesRemaining: 0,
    daysRemaining: 0,
  });

  useEffect(() => {
    async function checkSentryNewStatus() {
      try {
        const response = await api.requestPromise(
          `/organizations/${organization.slug}/sentrynew-status/`,
          {method: 'GET'}
        );

        if (response?.isSentryNew && !response?.isClaimed) {
          setOrgData(calculateTimeRemaining(response.expiresAt));
        }
      } catch (err) {
        // Ignore errors in content panel; overlay handles visibility
      }
    }

    checkSentryNewStatus();

    // Update every minute
    const interval = setInterval(checkSentryNewStatus, 60000);
    return () => clearInterval(interval);
  }, [api, organization.slug]);

  const handleClaim = useCallback(async () => {
    if (isSubmitting) return;

    openConfirmModal({
      header: t('Claim Your Sentry Account'),
      message: tct(
        'Are you ready to claim [orgName] and convert it to a permanent free tier organization? This action cannot be undone.',
        {orgName: <strong>{organization.name}</strong>}
      ),
      priority: 'primary',
      confirmText: t('Claim Organization'),
      onConfirm: async () => {
        setIsSubmitting(true);

        try {
          await api.requestPromise(
            `/organizations/${organization.slug}/claim-sentrynew/`,
            {method: 'POST'}
          );

          addSuccessMessage(t('Organization claimed successfully!'));

          // Reload to refresh organization state
          setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
          addErrorMessage(t('Failed to claim organization. Please try again.'));
        } finally {
          setIsSubmitting(false);
        }
      },
    });
  }, [api, organization, isSubmitting]);

  if (!orgData.isSentryNew) {
    return null;
  }

  if (orgData.isExpired) {
    return (
      <PanelContent>
        <IconStar size="xl" color="gray300" />
        <Title>{t('Trial Expired')}</Title>
        <Description>
          {t('Your Sentry trial has expired and will be deleted soon.')}
        </Description>
      </PanelContent>
    );
  }

  const timeDisplay =
    orgData.daysRemaining > 0
      ? tct('[days] day[plural] remaining', {
          days: orgData.daysRemaining,
          plural: orgData.daysRemaining === 1 ? '' : 's',
        })
      : orgData.hoursRemaining > 0
        ? tct('[hours] hour[plural] [minutes] minute[minutePlural] remaining', {
            hours: orgData.hoursRemaining,
            plural: orgData.hoursRemaining === 1 ? '' : 's',
            minutes: orgData.minutesRemaining,
            minutePlural: orgData.minutesRemaining === 1 ? '' : 's',
          })
        : tct('[minutes] minute[plural] remaining', {
            minutes: orgData.minutesRemaining,
            plural: orgData.minutesRemaining === 1 ? '' : 's',
          });

  return (
    <PanelContent>
      <IconStar size="xl" color="purple400" />
      <Title>{t('Claim Your Sentry Account')}</Title>

      <TimeBox
        urgency={
          orgData.minutesRemaining <= 15 &&
          orgData.daysRemaining === 0 &&
          orgData.hoursRemaining === 0
            ? 'critical'
            : orgData.hoursRemaining <= 6 && orgData.daysRemaining === 0
              ? 'warning'
              : 'info'
        }
      >
        <IconClock size="sm" />
        <strong>{timeDisplay}</strong>
      </TimeBox>

      <Description>
        {tct(
          'Your Sentry trial for [orgName] expires soon. Claim it now to convert it to a permanent free tier organization and keep all your data.',
          {orgName: <strong>{organization.name}</strong>}
        )}
      </Description>

      <ButtonContainer>
        <Button
          priority="primary"
          size="md"
          onClick={handleClaim}
          disabled={isSubmitting}
          style={{width: '100%'}}
        >
          {isSubmitting ? t('Claiming...') : t('Claim Organization')}
        </Button>

        <LearnMoreLink
          href="https://docs.sentry.io/trial"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('Learn More')}
        </LearnMoreLink>
      </ButtonContainer>
    </PanelContent>
  );
}

export function PrimaryNavigationSentryNewClaim() {
  const organization = useOrganization();
  const api = useApi();
  const [isSentryNew, setIsSentryNew] = useState(false);
  const [orgData, setOrgData] = useState<SentryNewOrgData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const {
    isOpen,
    triggerProps: overlayTriggerProps,
    overlayProps,
  } = usePrimaryButtonOverlay();

  useEffect(() => {
    async function checkSentryNewStatus() {
      try {
        const response = await api.requestPromise(
          `/organizations/${organization.slug}/sentrynew-status/`,
          {method: 'GET'}
        );

        if (response?.isSentryNew && !response?.isClaimed && !response?.isExpired) {
          setIsSentryNew(true);
          setOrgData(calculateTimeRemaining(response.expiresAt));
        } else {
          setIsSentryNew(false);
        }
      } catch (err) {
        setIsSentryNew(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkSentryNewStatus();

    // Update every minute
    const interval = setInterval(checkSentryNewStatus, 60000);
    return () => clearInterval(interval);
  }, [api, organization.slug]);

  // Don't show if not a sentrynew org, still loading, or if claimed
  if (!isSentryNew || isLoading || !orgData) {
    return null;
  }

  // Always show the sidebar item for unclaimed sentrynew orgs
  // It will be hidden only when the org is claimed

  return (
    <Fragment>
      <SentryNewButton
        analyticsKey="sentrynew_claim"
        label={t('Claim Organization')}
        buttonProps={overlayTriggerProps}
      >
        <CountdownIcon data={orgData} />
      </SentryNewButton>
      {isOpen && (
        <PrimaryButtonOverlay overlayProps={overlayProps}>
          <SentryNewClaimContent organization={organization} />
        </PrimaryButtonOverlay>
      )}
    </Fragment>
  );
}

// Styled Components
const SentryNewButton = styled(SidebarButton)`
  position: relative;
`;

const CountdownContainer = styled('div')<{urgency: 'critical' | 'warning' | 'info'}>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CountdownCircle = styled('div')<{urgency: 'critical' | 'warning' | 'info'}>`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid
    ${p =>
      p.urgency === 'critical'
        ? p.theme.red400
        : p.urgency === 'warning'
          ? p.theme.yellow400
          : p.theme.purple400};
  background: ${p =>
    p.urgency === 'critical'
      ? p.theme.red100
      : p.urgency === 'warning'
        ? p.theme.yellow100
        : p.theme.purple100};
`;

const CountdownText = styled('span')<{urgency: 'critical' | 'warning' | 'info'}>`
  font-size: 12px;
  font-weight: bold;
  color: ${p =>
    p.urgency === 'critical'
      ? p.theme.red400
      : p.urgency === 'warning'
        ? p.theme.yellow400
        : p.theme.purple400};
`;

const PanelContent = styled('div')`
  padding: ${space(3)};
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: ${space(2)};
`;

const Title = styled('h3')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const Description = styled('p')`
  margin: 0;
  color: ${p => p.theme.subText};
  line-height: 1.5;
`;

const TimeBox = styled('div')<{urgency: 'critical' | 'warning' | 'info'}>`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  padding: ${space(1)} ${space(2)};
  background: ${p =>
    p.urgency === 'critical'
      ? p.theme.red100
      : p.urgency === 'warning'
        ? p.theme.yellow100
        : p.theme.purple100};
  color: ${p =>
    p.urgency === 'critical'
      ? p.theme.red400
      : p.urgency === 'warning'
        ? p.theme.yellow400
        : p.theme.purple400};
  border-radius: ${p => p.theme.radius.md};
  font-size: ${p => p.theme.fontSize.sm};
`;

const ButtonContainer = styled('div')`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  align-items: center;
`;

const LearnMoreLink = styled('a')`
  color: ${p => p.theme.linkColor};
  font-size: ${p => p.theme.fontSize.sm};

  &:hover {
    text-decoration: underline;
  }
`;
