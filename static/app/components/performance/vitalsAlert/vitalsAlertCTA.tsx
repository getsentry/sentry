import {useEffect} from 'react';
import styled from '@emotion/styled';
import maxBy from 'lodash/maxBy';

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
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import {
  INDUSTRY_STANDARDS,
  MIN_VITAL_COUNT_FOR_DISPLAY,
  SENTRY_CUSTOMERS,
} from './constants';
import {VitalsKey, VitalsResult} from './types';
import {getCountParameterName, getRelativeDiff, getWorstVital} from './utils';

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

export default function VitalsAlertCTA({data, dismissAlert}: Props) {
  const organization = useOrganization();
  // persist to dismiss alert
  const api = useApi({persistInFlight: true});
  const vital = getWorstVital(data);
  const userVitalValue = vital ? data[vital] : 0;
  const sentryDiff = vital ? getRelativeDiff(userVitalValue, SENTRY_CUSTOMERS[vital]) : 0;
  const industryDiff = vital
    ? getRelativeDiff(userVitalValue, INDUSTRY_STANDARDS[vital])
    : 0;

  // must have the global-views
  // and either be an owner/member or the org allows open membership
  const canSeeAllProjects =
    organization.features.includes('global-views') &&
    (['owner', 'manager'].includes(organization.orgRole || '') ||
      organization.features.includes('open-membership'));

  // find the project that has the most events of the same type
  const bestProjectData = vital
    ? maxBy(data.projectData, item => {
        const parameterName = getCountParameterName(vital);
        return item[parameterName];
      })
    : null;

  const industryDiffPercentage = getPercentage(industryDiff);
  const sentryDiffPercentage = getPercentage(sentryDiff);
  const vitalsType = vital ? getVitalsType(vital) : null;

  const getAnalyticsParams = () => {
    // shouldn't call any analytics function if this is missing
    // but this check helps us with typing
    if (!vital || !vitalsType) {
      throw new Error('Cannot get analytics params without vital');
    }
    return {
      vital,
      vitals_type: vitalsType,
      organization,
      user_vital_value: userVitalValue,
      sentry_diff: sentryDiff,
      industry_diff: industryDiff,
      can_see_all_projects: canSeeAllProjects,
    } as const;
  };

  const showVitalsAlert = () => {
    // check if we have the vital and the count is at least at the min
    if (!vital || userVitalValue < MIN_VITAL_COUNT_FOR_DISPLAY) {
      return false;
    }
    // if worst vital is better than Sentry users, we shouldn't show this alert
    if (sentryDiff < 0) {
      return false;
    }
    // must either be able to see all proejcts or we can pick a specific project
    return canSeeAllProjects || bestProjectData;
  };

  useEffect(() => {
    if (!vital || !showVitalsAlert()) {
      return;
    }
    trackAdvancedAnalyticsEvent('vitals_alert.displayed', getAnalyticsParams());
  });

  if (!vital || !showVitalsAlert()) {
    return null;
  }

  function getVitalWithLink() {
    if (!vital) {
      throw new Error('Cannot get vitals link without vital');
    }
    const url = new URL(getDocsLink(vital));
    url.searchParams.append('referrer', 'vitals-alert');
    return (
      <ExternalLink
        onClick={() => {
          trackAdvancedAnalyticsEvent('vitals_alert.clicked_docs', getAnalyticsParams());
        }}
        href={url.toString()}
      >
        {vital}
      </ExternalLink>
    );
  }

  const getText = () => {
    const args = {
      vital: getVitalWithLink(),
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
    const performanceRoot = `/organizations/${organization.slug}/performance`;
    const baseParams: Record<string, string | undefined> = {
      statsPeriod: '7d',
      referrer: `vitals-alert-${vital.toLowerCase()}`,
      project: canSeeAllProjects ? '-1' : bestProjectData?.projectId,
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
            trackAdvancedAnalyticsEvent(
              'vitals_alert.clicked_see_vitals',
              getAnalyticsParams()
            );
          }}
        >
          {buttonText}
        </Button>

        <Button
          icon={<IconClose />}
          onClick={() => {
            dismissAndPromptUpdate();
            trackAdvancedAnalyticsEvent('vitals_alert.dismissed', getAnalyticsParams());
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
