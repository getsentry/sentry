import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Card from 'sentry/components/card';
import {openConfirmModal} from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {IconClock, IconClose, IconStar} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import useApi from 'sentry/utils/useApi';

interface SentryNewClaimBannerProps {
  organization: Organization;
  onClaim?: () => void;
}

interface SentryNewOrgData {
  expiresAt: Date | null;
  hoursRemaining: number;
  isClaimed: boolean;
  isExpired: boolean;
  isSentryNew: boolean;
  minutesRemaining: number;
  percentRemaining: number;
}

function calculateTimeRemaining(expiresAt: string | null): SentryNewOrgData {
  if (!expiresAt) {
    return {
      isSentryNew: false,
      isClaimed: false,
      isExpired: false,
      expiresAt: null,
      hoursRemaining: 0,
      minutesRemaining: 0,
      percentRemaining: 0,
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
      hoursRemaining: 0,
      minutesRemaining: 0,
      percentRemaining: 0,
    };
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  // Assume 1 hour total time for percentage calculation
  const percentRemaining = Math.min(100, (totalMinutes / 60) * 100);

  return {
    isSentryNew: true,
    isClaimed: false,
    isExpired: false,
    expiresAt: expirationTime,
    hoursRemaining: hours,
    minutesRemaining: minutes,
    percentRemaining,
  };
}

export function SentryNewClaimBanner({organization, onClaim}: SentryNewClaimBannerProps) {
  const api = useApi();
  const [isVisible, setIsVisible] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orgData, setOrgData] = useState<SentryNewOrgData>({
    isSentryNew: false,
    isClaimed: false,
    isExpired: false,
    expiresAt: null,
    hoursRemaining: 0,
    minutesRemaining: 0,
    percentRemaining: 0,
  });

  const LOCAL_STORAGE_KEY = `sentrynew-banner-dismissed-${organization.slug}`;
  const SNOOZE_STORAGE_KEY = `sentrynew-banner-snoozed-${organization.slug}`;

  // Check if this is a sentrynew org and get expiration data
  useEffect(() => {
    async function checkSentryNewStatus() {
      try {
        const response = await api.requestPromise(
          `/organizations/${organization.slug}/sentrynew-status/`,
          {method: 'GET'}
        );

        if (response?.isSentryNew && !response?.isClaimed) {
          setOrgData(calculateTimeRemaining(response.expiresAt));
        } else {
          setIsVisible(false);
        }
      } catch (err: any) {
        // On any error from the status endpoint, hide the banner
        setIsVisible(false);
      }
    }

    // Check local storage for dismissal
    const isDismissed = localStorage.getItem(LOCAL_STORAGE_KEY);
    const snoozedUntil = localStorage.getItem(SNOOZE_STORAGE_KEY);

    if (isDismissed === 'true') {
      setIsVisible(false);
      return;
    }

    if (snoozedUntil) {
      const snoozeExpiry = new Date(snoozedUntil);
      if (snoozeExpiry > new Date()) {
        setIsVisible(false);
        return;
      }
    }

    checkSentryNewStatus();
  }, [api, organization.slug, LOCAL_STORAGE_KEY, SNOOZE_STORAGE_KEY]);

  // Update countdown every minute
  useEffect(() => {
    if (!orgData.isSentryNew || orgData.isClaimed || orgData.isExpired) {
      return;
    }

    const interval = setInterval(() => {
      if (orgData.expiresAt) {
        setOrgData(calculateTimeRemaining(orgData.expiresAt.toISOString()));
      }
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [orgData]);

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
            {
              method: 'POST',
            }
          );

          addSuccessMessage(t('Organization claimed successfully!'));
          setIsVisible(false);
          localStorage.setItem(LOCAL_STORAGE_KEY, 'true');

          trackAnalytics('sentrynew_banner.claimed', {
            organization,
          });

          if (onClaim) {
            onClaim();
          }

          // Reload to refresh organization state
          setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
          addErrorMessage(t('Failed to claim organization. Please try again.'));
        } finally {
          setIsSubmitting(false);
        }
      },
    });
  }, [api, organization, isSubmitting, onClaim, LOCAL_STORAGE_KEY]);

  const handleSnooze = useCallback(() => {
    // Snooze for 30 minutes
    const snoozeUntil = new Date();
    snoozeUntil.setMinutes(snoozeUntil.getMinutes() + 30);

    localStorage.setItem(SNOOZE_STORAGE_KEY, snoozeUntil.toISOString());
    setIsVisible(false);

    trackAnalytics('sentrynew_banner.snoozed', {
      organization,
      minutesRemaining: orgData.hoursRemaining * 60 + orgData.minutesRemaining,
    });
  }, [organization, orgData, SNOOZE_STORAGE_KEY]);

  const handleDismiss = useCallback(() => {
    openConfirmModal({
      header: t('Dismiss Banner'),
      message: t(
        'Are you sure you want to dismiss this banner? You can still claim your organization from the settings page.'
      ),
      confirmText: t('Dismiss'),
      priority: 'danger',
      onConfirm: () => {
        localStorage.setItem(LOCAL_STORAGE_KEY, 'true');
        setIsVisible(false);

        trackAnalytics('sentrynew_banner.dismissed', {
          organization,
          minutesRemaining: orgData.hoursRemaining * 60 + orgData.minutesRemaining,
        });
      },
    });
  }, [organization, orgData, LOCAL_STORAGE_KEY]);

  // Track banner view
  useEffect(() => {
    if (isVisible && orgData.isSentryNew) {
      trackAnalytics('sentrynew_banner.viewed', {
        organization,
        minutesRemaining: orgData.hoursRemaining * 60 + orgData.minutesRemaining,
      });
    }
  }, [isVisible, orgData, organization]);

  if (!isVisible || !orgData.isSentryNew || orgData.isClaimed) {
    return null;
  }

  const urgencyLevel =
    orgData.minutesRemaining <= 15
      ? 'critical'
      : orgData.minutesRemaining <= 30
        ? 'warning'
        : 'info';

  return (
    <AnimatePresence>
      <BannerWrapper
        initial={{opacity: 0, y: -20}}
        animate={{opacity: 1, y: 0}}
        exit={{opacity: 0, y: -20}}
        transition={{duration: 0.3}}
      >
        <BannerCard urgency={urgencyLevel}>
          <CloseButton
            icon={<IconClose />}
            size="zero"
            borderless
            onClick={handleDismiss}
            aria-label={t('Dismiss banner')}
          />

          <BannerContent>
            <IconSection urgency={urgencyLevel}>
              <IconStar size="xl" />
            </IconSection>

            <ContentSection>
              <BannerHeader>
                <BannerTitle urgency={urgencyLevel}>
                  {orgData.isExpired
                    ? t('Your Sentry Trial Has Expired')
                    : t('Claim Your Sentry Account')}
                </BannerTitle>

                {!orgData.isExpired && (
                  <TimeRemaining urgency={urgencyLevel}>
                    <IconClock size="sm" />
                    {orgData.hoursRemaining > 0
                      ? tct('[hours]h [minutes]m remaining', {
                          hours: orgData.hoursRemaining,
                          minutes: orgData.minutesRemaining,
                        })
                      : tct('[minutes] minutes remaining', {
                          minutes: orgData.minutesRemaining,
                        })}
                  </TimeRemaining>
                )}
              </BannerHeader>

              <BannerDescription>
                {orgData.isExpired
                  ? t(
                      'Your Sentry organization has expired and will be deleted soon. Contact support if you need assistance.'
                    )
                  : tct(
                      'Your Sentry trial expires soon! Claim [orgName] now to convert it to a permanent free tier account and keep all your data.',
                      {orgName: <strong>{organization.name}</strong>}
                    )}
              </BannerDescription>

              {!orgData.isExpired && (
                <ButtonGroup>
                  <Button
                    priority="primary"
                    size="sm"
                    onClick={handleClaim}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? t('Claiming...') : t('Claim Organization')}
                  </Button>

                  <Button
                    priority="default"
                    size="sm"
                    onClick={handleSnooze}
                    disabled={isSubmitting}
                  >
                    {t('Remind Me Later')}
                  </Button>

                  <LearnMoreLink
                    href="https://docs.sentry.io/sentrynew"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('Learn More')}
                  </LearnMoreLink>
                </ButtonGroup>
              )}
            </ContentSection>
          </BannerContent>

          {!orgData.isExpired && (
            <ProgressBar>
              <ProgressFill
                percent={orgData.percentRemaining}
                urgency={urgencyLevel}
                initial={{width: '100%'}}
                animate={{width: `${orgData.percentRemaining}%`}}
                transition={{duration: 0.5}}
              />
            </ProgressBar>
          )}
        </BannerCard>
      </BannerWrapper>
    </AnimatePresence>
  );
}

// Styled Components
const BannerWrapper = styled(motion.div)`
  margin-bottom: ${space(2)};
`;

const BannerCard = styled(Card)<{urgency: 'info' | 'warning' | 'critical'}>`
  position: relative;
  padding: ${space(2)};
  border: 1px solid
    ${p =>
      p.urgency === 'critical'
        ? p.theme.red300
        : p.urgency === 'warning'
          ? p.theme.yellow300
          : p.theme.purple200};
  background: ${p =>
    p.urgency === 'critical'
      ? `linear-gradient(to right, ${p.theme.red100}, ${p.theme.background})`
      : p.urgency === 'warning'
        ? `linear-gradient(to right, ${p.theme.yellow100}, ${p.theme.background})`
        : `linear-gradient(to right, ${p.theme.purple100}, ${p.theme.background})`};
  overflow: hidden;
`;

const CloseButton = styled(Button)`
  position: absolute;
  top: ${space(1)};
  right: ${space(1)};
  color: ${p => p.theme.subText};

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const BannerContent = styled('div')`
  display: flex;
  align-items: flex-start;
  gap: ${space(2)};
`;

const IconSection = styled('div')<{urgency: 'info' | 'warning' | 'critical'}>`
  flex-shrink: 0;
  color: ${p =>
    p.urgency === 'critical'
      ? p.theme.red400
      : p.urgency === 'warning'
        ? p.theme.yellow400
        : p.theme.purple400};
`;

const ContentSection = styled('div')`
  flex: 1;
  min-width: 0;
`;

const BannerHeader = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(2)};
  margin-bottom: ${space(1)};
  flex-wrap: wrap;
`;

const BannerTitle = styled('h3')<{urgency: 'info' | 'warning' | 'critical'}>`
  margin: 0;
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p =>
    p.urgency === 'critical'
      ? p.theme.red400
      : p.urgency === 'warning'
        ? p.theme.yellow400
        : p.theme.purple400};
`;

const TimeRemaining = styled('div')<{urgency: 'info' | 'warning' | 'critical'}>`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  padding: ${space(0.5)} ${space(1)};
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
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const BannerDescription = styled('p')`
  margin: 0 0 ${space(1.5)};
  color: ${p => p.theme.tokens.content.primary};
  line-height: 1.5;
`;

const ButtonGroup = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  flex-wrap: wrap;
`;

const LearnMoreLink = styled('a')`
  color: ${p => p.theme.linkColor};
  font-size: ${p => p.theme.fontSize.sm};

  &:hover {
    text-decoration: underline;
  }
`;

const ProgressBar = styled('div')`
  position: absolute;
  bottom: -${space(2)};
  left: -${space(2)};
  right: -${space(2)};
  height: 3px;
  background: ${p => p.theme.backgroundSecondary};
`;

const ProgressFill = styled(motion.div)<{
  percent: number;
  urgency: 'info' | 'warning' | 'critical';
}>`
  height: 100%;
  background: ${p =>
    p.urgency === 'critical'
      ? p.theme.red400
      : p.urgency === 'warning'
        ? p.theme.yellow400
        : p.theme.purple400};
  transition: width 0.3s ease;
`;

export default SentryNewClaimBanner;
