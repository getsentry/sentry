import styled from '@emotion/styled';

import {promptsUpdate} from 'sentry/actionCreators/prompts';
import {
  NotificationBar,
  StyledNotificationBarIconInfo,
} from 'sentry/components/alerts/notificationBar';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import {INDUSTRY_STANDARDS, SENTRY_CUSTOMERS} from './constants';
import {VitalsKey, VitalsResult} from './types';
import {getRelativeDiff, getWorstVital} from './utils';

interface Props {
  data: VitalsResult;
  dismissAlert: () => void;
}

function getPercentage(diff: number) {
  return <strong>{Math.abs(Math.round(diff * 100))}%</strong>;
}

function getDocsLink(vital: VitalsKey) {
  switch (vital) {
    case 'FCP':
      return 'https://docs.sentry.io/product/performance/web-vitals/#first-contentful-paint-fcp';
    case 'LCP':
      return 'https://docs.sentry.io/product/performance/web-vitals/#largest-contentful-paint-lcp';
    default:
      // just one link for mobile vitals
      return 'https://docs.sentry.io/product/performance/mobile-vitals/#app-start';
  }
}

function getVitalsType(vital: VitalsKey) {
  return ['FCP', 'LCP'].includes(vital) ? 'web' : 'mobile';
}

function getVitalWithLink({
  vital,
  organization,
}: {
  organization: Organization;
  vital: VitalsKey;
}) {
  const url = new URL(getDocsLink(vital));
  url.searchParams.append('referrer', 'vitals-alert');
  return (
    <ExternalLink
      onClick={() => {
        trackAdvancedAnalyticsEvent('vitals_alert.clicked_docs', {vital, organization});
      }}
      href={url.toString()}
    >
      {vital}
    </ExternalLink>
  );
}

export default function VitalsAlertCTA({data, dismissAlert}: Props) {
  const organization = useOrganization();
  // persist to dismiss alert
  const api = useApi({persistInFlight: true});
  const vital = getWorstVital(data);
  if (!vital) {
    return null;
  }
  const ourValue = data[vital];
  if (!ourValue) {
    return null;
  }
  const sentryDiff = getRelativeDiff(ourValue, SENTRY_CUSTOMERS[vital]);
  const industryDiff = getRelativeDiff(ourValue, INDUSTRY_STANDARDS[vital]);

  // if worst vital is better than Sentry users, we shouldn't show this alert
  if (sentryDiff < 0) {
    return null;
  }

  const industryDiffPercentage = getPercentage(industryDiff);
  const sentryDiffPercentage = getPercentage(sentryDiff);
  const vitalsType = getVitalsType(vital);

  const getText = () => {
    const args = {
      vital: getVitalWithLink({vital, organization}),
      industryDiffPercentage,
      sentryDiffPercentage,
    };
    // different language if we are better than the industry average
    if (industryDiff < 0) {
      return tct(
        "Your organization's [vital] is [industryDiffPercentage] lower than the industry standard, but [sentryDiffPercentage] higher than typical Sentry users.",
        args
      );
    }
    return tct(
      "Your organization's [vital] is [industryDiffPercentage] higher than the industry standard and [sentryDiffPercentage] higher than typical Sentry users.",
      args
    );
  };

  const getVitalsURL = () => {
    // TODO: add logic for project selection
    const performanceRoot = `/organizations/${organization.slug}/performance`;
    const baseParams = {
      statsPeriod: '7d',
      referrer: `vitals-alert-${vital.toLowerCase()}`,
    };
    // we can land on a specific web vital
    if (vitalsType === 'web') {
      const searchParams = new URLSearchParams({
        ...baseParams,
        vitalName: `measurements.${vital.toLowerCase()}`,
      });
      return `${performanceRoot}/vitaldetail/?${searchParams}`;
    }
    // otherwise it's just the mobile vital screen
    const searchParams = new URLSearchParams({
      ...baseParams,
      landingDisplay: 'mobile',
    });
    return `${performanceRoot}/?${searchParams}`;
  };

  const buttonText = vitalsType === 'web' ? t('See Web Vitals') : t('See Mobile Vitals');
  const dismissAndPromptUpdate = () => {
    promptsUpdate(api, {
      organizationId: organization?.id,
      feature: 'vitals_alert',
      status: 'dismissed',
    });
    dismissAlert();
  };

  return (
    <NotificationBar>
      <StyledNotificationBarIconInfo />
      {getText()}
      <NotificationBarButtons gap={1}>
        <Button
          to={getVitalsURL()}
          size="xs"
          onClick={() => {
            dismissAndPromptUpdate();
            trackAdvancedAnalyticsEvent('vitals_alert.clicked_see_vitals', {
              vital,
              organization,
            });
          }}
        >
          {buttonText}
        </Button>

        <Button
          icon={<IconClose />}
          onClick={() => {
            dismissAndPromptUpdate();
            trackAdvancedAnalyticsEvent('vitals_alert.dismissed', {
              vital,
              organization,
            });
          }}
          size="xs"
          priority="link"
          title={t('Dismiss')}
          aria-label={t('Dismiss')}
        />
      </NotificationBarButtons>
    </NotificationBar>
  );
}

const NotificationBarButtons = styled(ButtonBar)`
  margin-left: auto;
  white-space: nowrap;
`;
