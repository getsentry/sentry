import {useCallback, useEffect, useState} from 'react';
import {useTheme} from '@emotion/react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import ExternalLink from 'sentry/components/links/externalLink';
import NarrowLayout from 'sentry/components/narrowLayout';
import {IconCheckmark, IconClock, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import useApi from 'sentry/utils/useApi';

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface SentryNewPartnershipAgreementProps {
  organization: Organization;
  onSubmitSuccess?: () => void;
}

interface SentryNewOrgData {
  expiresAt: Date | null;
  isClaimed: boolean;
  isExpired: boolean;
  timeRemaining: string;
}

function calculateTimeRemaining(expiresAt: string | null): SentryNewOrgData {
  if (!expiresAt) {
    // Default to 1 hour from now if no expiration provided
    const defaultExpires = new Date();
    defaultExpires.setHours(defaultExpires.getHours() + 1);
    return {
      isExpired: false,
      isClaimed: false,
      timeRemaining: t('1 hour'),
      expiresAt: defaultExpires,
    };
  }

  const expires = new Date(expiresAt);
  const now = new Date();
  const diff = expires.getTime() - now.getTime();

  if (diff <= 0) {
    return {
      isExpired: true,
      isClaimed: false,
      timeRemaining: t('Expired - Pending deletion'),
      expiresAt: expires,
    };
  }

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  const timeRemaining =
    hours > 0
      ? t('%(hours)s hour%(hourPlural)s %(mins)s minute%(minPlural)s', {
          hours,
          hourPlural: hours === 1 ? '' : 's',
          mins,
          minPlural: mins === 1 ? '' : 's',
        })
      : t('%(mins)s minute%(minPlural)s', {
          mins,
          minPlural: mins === 1 ? '' : 's',
        });

  return {
    isExpired: false,
    isClaimed: false,
    timeRemaining,
    expiresAt: expires,
  };
}

export default function SentryNewPartnershipAgreement({
  organization,
  onSubmitSuccess,
}: SentryNewPartnershipAgreementProps) {
  const api = useApi();
  const theme = useTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);
  const [orgData, setOrgData] = useState<SentryNewOrgData>(() => {
    // Initialize with default 1 hour from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    return calculateTimeRemaining(expiresAt.toISOString());
  });

  // Update countdown every minute
  useEffect(() => {
    if (!isClaimed && !orgData.isExpired && orgData.expiresAt) {
      const updateTimer = () => {
        setOrgData(calculateTimeRemaining(orgData.expiresAt?.toISOString() || null));
      };

      // Update immediately
      updateTimer();

      // Then update every minute
      const interval = setInterval(updateTimer, 60000);

      return () => clearInterval(interval);
    }
    return undefined;
  }, [isClaimed, orgData.isExpired, orgData.expiresAt]);

  const actualClaimRequest = useCallback(async () => {
    try {
      await api.requestPromise(
        `/api/0/organizations/${organization.slug}/claim-sentrynew/`,
        {
          method: 'POST',
        }
      );

      // Success!
      setIsClaimed(true);
      addSuccessMessage(
        t('Organization claimed successfully! A confirmation email has been sent.')
      );

      // Dismiss the partnership agreement dialog
      // Call the original partnership agreement endpoint to mark as accepted
      try {
        await api.requestPromise(
          `/api/0/organizations/${organization.slug}/partnership-agreements/`,
          {
            method: 'POST',
          }
        );
      } catch (dismissError) {
        // Non-critical, log but don't fail
        console.warn('Failed to dismiss partnership agreement:', dismissError);
      }

      // Call success callback if provided
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
    } catch (error: any) {
      console.error('Failed to claim organization:', error);

      // Check if already claimed
      if (error?.responseJSON?.claimed === true) {
        setIsClaimed(true);
        addSuccessMessage(t('This organization has already been claimed.'));

        // Still try to dismiss the dialog
        if (onSubmitSuccess) {
          onSubmitSuccess();
        }
      } else {
        addErrorMessage(
          t('Failed to claim organization. Please try again or contact support.')
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [api, organization, onSubmitSuccess]);

  const handleClaimOrganization = useCallback(async () => {
    setIsSubmitting(true);

    try {
      // Show confirmation modal
      openConfirmModal({
        header: t('Claim This Organization'),
        message: (
          <div>
            <p>
              {t(
                'By claiming this organization, you confirm that you want to keep it active beyond the 1-hour trial period.'
              )}
            </p>
            <div
              style={{
                background: theme.backgroundSecondary,
                padding: '16px',
                borderRadius: '8px',
                margin: '16px 0',
              }}
            >
              <h4 style={{margin: '0 0 12px 0', color: theme.textColor}}>
                {t('This action will:')}
              </h4>
              <ul style={{margin: '0', paddingLeft: '20px', color: theme.textColor}}>
                <li>{t('Prevent automatic deletion of this organization')}</li>
                <li>{t('Convert it to a permanent free-tier organization')}</li>
                <li>{t('Send a confirmation email to your registered address')}</li>
              </ul>
            </div>
            <p style={{marginBottom: 0}}>
              <strong>{t('Are you sure you want to claim this organization?')}</strong>
            </p>
          </div>
        ),
        confirmText: t('Yes, Claim Organization'),
        cancelText: t('Cancel'),
        priority: 'primary',
        onConfirm: () => {
          actualClaimRequest();
        },
        onCancel: () => {
          setIsSubmitting(false);
        },
      });

      return;
    } catch (error) {
      addErrorMessage(t('Failed to start claim process.'));
      setIsSubmitting(false);
    }
  }, [actualClaimRequest]);

  const handleContinueEvaluating = useCallback(async () => {
    setIsSubmitting(true);
    try {
      // Just dismiss the dialog without claiming
      await api.requestPromise(
        `/api/0/organizations/${organization.slug}/partnership-agreements/`,
        {
          method: 'POST',
        }
      );
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
    } catch (error) {
      console.error('Failed to dismiss dialog:', error);
      addErrorMessage(t('An error occurred. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }, [api, organization.slug, onSubmitSuccess]);

  // Render claimed state
  if (isClaimed) {
    return (
      <NarrowLayout>
        <div style={{textAlign: 'center', padding: '2rem'}}>
          <div style={{fontSize: '48px', marginBottom: '1rem'}}>
            <IconCheckmark color="success" size="xl" />
          </div>
          <h2>{t('Organization Claimed!')}</h2>
          <Alert type="success" showIcon style={{marginTop: '1rem', textAlign: 'left'}}>
            {t(
              'Your organization has been successfully claimed and converted to a permanent free-tier account. You will receive a confirmation email shortly.'
            )}
          </Alert>
          <Button
            priority="primary"
            size="md"
            onClick={() => onSubmitSuccess?.()}
            style={{marginTop: '2rem'}}
          >
            {t('Get Started')}
          </Button>
        </div>
      </NarrowLayout>
    );
  }

  // Render expired state
  if (orgData.isExpired) {
    return (
      <NarrowLayout>
        <div style={{textAlign: 'center', padding: '2rem'}}>
          <div style={{fontSize: '48px', marginBottom: '1rem'}}>
            <IconWarning color="error" size="xl" />
          </div>
          <h2>{t('Trial Period Expired')}</h2>
          <Alert type="error" showIcon style={{marginTop: '1rem', textAlign: 'left'}}>
            {t(
              'This evaluation organization has expired and is scheduled for automatic deletion. You can still claim it now to prevent deletion.'
            )}
          </Alert>
          <Button
            priority="primary"
            size="md"
            onClick={handleClaimOrganization}
            disabled={isSubmitting}
            style={{marginTop: '2rem'}}
          >
            {isSubmitting ? t('Claiming...') : t('Claim Organization Now')}
          </Button>
        </div>
      </NarrowLayout>
    );
  }

  // Render normal evaluation state
  return (
    <NarrowLayout>
      <div style={{textAlign: 'center', padding: '2rem'}}>
        <h2>{t('Welcome to your Sentry Organization!')}</h2>

        <div
          style={{
            background: theme.red100,
            border: `2px solid ${theme.red200}`,
            borderRadius: '8px',
            padding: '16px',
            margin: '20px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}
        >
          <IconClock size="md" color="red300" />
          <div>
            <strong style={{color: theme.red400, fontSize: '18px'}}>
              {t('Time Remaining: %(time)s', {time: orgData.timeRemaining})}
            </strong>
            <div style={{fontSize: '14px', color: theme.red400, marginTop: '4px'}}>
              {t('This organization will be automatically deleted if not claimed')}
            </div>
          </div>
        </div>

        <p style={{fontSize: '16px', lineHeight: '1.6', marginBottom: '2rem'}}>
          {t(
            "This is a temporary Sentry evaluation organization. You can explore Sentry's features, build projects, and experiment freely. After 1 hour, it will be automatically deleted unless you claim it."
          )}
        </p>

        <div
          style={{
            background: theme.backgroundSecondary,
            padding: '20px',
            borderRadius: '8px',
            margin: '20px 0',
            textAlign: 'left',
          }}
        >
          <h3 style={{margin: '0 0 12px 0', color: theme.textColor}}>
            {t('Your Options:')}
          </h3>
          <ul
            style={{
              margin: '0',
              paddingLeft: '20px',
              lineHeight: '1.8',
              color: theme.textColor,
            }}
          >
            <li>
              <strong>{t('Claim Organization:')}</strong>{' '}
              {t('Convert to a permanent free-tier account (prevents deletion)')}
            </li>
            <li>
              <strong>{t('Continue Evaluating:')}</strong>{' '}
              {t('Keep exploring until the timer expires')}
            </li>
          </ul>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: '2rem',
          }}
        >
          <Button
            priority="primary"
            size="md"
            onClick={handleClaimOrganization}
            disabled={isSubmitting}
          >
            {isSubmitting ? t('Processing...') : t('Claim Organization')}
          </Button>
          <Button
            priority="default"
            size="md"
            onClick={handleContinueEvaluating}
            disabled={isSubmitting}
          >
            {t('Continue Evaluating')}
          </Button>
        </div>

        <p style={{fontSize: '14px', color: theme.subText, marginTop: '2rem'}}>
          {tct("By using this service, you agree to Sentry's [tos] and [privacy].", {
            tos: (
              <ExternalLink href="https://sentry.io/terms/">
                {t('Terms of Service')}
              </ExternalLink>
            ),
            privacy: (
              <ExternalLink href="https://sentry.io/privacy/">
                {t('Privacy Policy')}
              </ExternalLink>
            ),
          })}
        </p>
      </div>
    </NarrowLayout>
  );
}
