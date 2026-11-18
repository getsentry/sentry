import {Fragment, useEffect, useEffectEvent, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';
import dataRetentionImg from 'getsentry-images/features/data-retention.svg';
import dataVolumeImg from 'getsentry-images/features/event-volume.svg';
import integrationAlerts from 'getsentry-images/features/integration-alerts.svg';
import incidentsImg from 'getsentry-images/features/metric-alerts.svg';
import ssoImg from 'getsentry-images/features/sso.svg';

import {Grid} from '@sentry/scraps/layout';

import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {FeatureList} from 'getsentry/components/upsellModal/featureList';
import {Footer} from 'getsentry/components/upsellModal/footer';
import {HighlightedFeature} from 'getsentry/components/upsellModal/highlightedFeature';
import type {Feature} from 'getsentry/components/upsellModal/types';
import {useFeatureRotation} from 'getsentry/components/upsellModal/useFeatureRotation';
import type {Subscription} from 'getsentry/types';
import {getTrialLength, isTrial} from 'getsentry/utils/billing';
import {trackGetsentryAnalytics} from 'getsentry/utils/trackGetsentryAnalytics';

/**
 * When the details are first mounted, until the user clicks one we will rotate
 * through the list of features with this time interval.
 */
const ROTATE_INTERVAL = 6000;

/**
 * Time before the first rotate. A little longer giving the user time to read
 * the first page
 */
const FIRST_ROTATE_TIMEOUT = 10000;

type Props = {
  onCloseModal: () => void;
  organization: Organization;
  /**
   * Source opener of the modal. If this matches a feature ID that feature
   * will be highlighted upon first render.
   */
  source: string;
  subscription: Subscription;
};

/**
 * All available features. Mostly just cataloged into this variable for ease of
 * understanding.
 */
const ALL_FEATURE_LIST: Feature[] = [
  {
    id: 'extended-data-retention',
    planFeatures: ['extended-data-retention'],
    name: t('Extended Data Retention'),
    image: dataRetentionImg,
    desc: tct(
      'Want to access your event data for longer? Extend your data history to 90 days for more visibility into events and the root cause of exceptions.',
      {strong: <strong />}
    ),
  },
  {
    id: 'sso',
    planFeatures: ['sso-saml2'],
    name: t('SAML2 Sign In'),
    image: ssoImg,
    desc: tct(
      'Streamline onboarding and off-boarding by logging in securely through one of our SSO integrations: [strong: Okta, Active Directory, OneLogin, and AuthO].',
      {strong: <strong />}
    ),
  },
  {
    id: 'event-volume',
    planFeatures: ['discard-groups', 'custom-inbound-filters', 'rate-limits'],
    name: t('Event Volume Controls'),
    image: dataVolumeImg,
    desc: tct(
      'Control event volume with robust data filters and rate limits. Have something big coming up? Track daily usage by project in Organization Stats.',
      {strong: <strong />}
    ),
  },
  {
    id: 'incidents',
    planFeatures: ['incidents'],
    name: t('Error Metric Alerts'),
    image: incidentsImg,
    desc: tct(
      'Go beyond Issues and set Metric Alerts to detect critical spikes on the frequency of any subset of your events, filtered on tags or attributes.',
      {strong: <strong />}
    ),
  },
  {
    id: 'integration-alerts',
    planFeatures: ['integrations-ticket-rules'],
    name: t('Advanced Integrations'),
    image: integrationAlerts,
    desc: tct(
      'Automatically create Jira and Azure DevOps Tickets based on custom alerts you set up in Sentry. Stop manually filling out forms.',
      {strong: <strong />}
    ),
  },
];

const selectFeatures = (features: string[]) =>
  features.map(id => ALL_FEATURE_LIST.find(f => f.id === id)!);

const TEAM_FEATURES = selectFeatures(['extended-data-retention']).filter(Boolean);

const BUSINESS_FEATURES = selectFeatures([
  'discover-query',
  'change-alerts',
  'event-volume',
  'sso',
  'integration-alerts',
  'team-roles-upsell',
  'anomaly-detection-alerts',
]).filter(Boolean);

function getFeatures(subscription: Subscription): Feature[] {
  return subscription.isFree || subscription.onTrialPlan
    ? [...BUSINESS_FEATURES, ...TEAM_FEATURES]
    : BUSINESS_FEATURES;
}

function getDefaultMessaging(subscription: Subscription, organization: Organization) {
  const sentences = isTrial(subscription)
    ? [
        t(
          `With your trial you have access to Sentry’s Power Features, which
             offer a macro-level perspective of error trends and application
             health, while also allowing you to drill down into a single
             issue or event with Dashboards and Discover-powered queries.`
        ),
        t(
          `We hope you’re enjoying these new features to create complex
             queries against event data, see all issues across projects, and
             view dashboards for a comprehensive and holistic view.`
        ),
      ]
    : [
        t(
          `We added a bunch of new features that made Sentry a whole lot better.
           If we do say so ourselves.`
        ),
        t(
          `To get more out of Sentry and life in general, switch over to our new and
           improved Business Plan. You'll get transactions, attachments, access to
           Performance, and features that won't be released on our legacy plans.`
        ),
        t(
          `Confusing, we know. Basically, your Sentry organization is perfect just the way it is,
           but upgrade now if you want it to be even better. `
        ),
      ];

  const cta =
    subscription.canTrial && !isTrial(subscription)
      ? t(
          'Enable all power features by starting your %s day trial',
          getTrialLength(organization)
        )
      : tct('Upgrade to our [strong:Business Plan] today.', {strong: <strong />});

  return {sentences, cta};
}

function usePreloadImages(urls: string[]) {
  useEffect(() => {
    for (const url of urls) {
      const img = new Image();
      img.src = url;
    }
  }, [urls]);
}

interface LandingAnalyticsOptions {
  highlightedFeatureId: string | null;
  organization: Organization;
  source: string;
  subscription: Subscription;
}

/**
 * Tracks when the landing is viewed and closed. The closed event reports
 * whichever feature is highlighted at unmount, not the one at mount.
 */
export function useUpsellLandingAnalytics({
  highlightedFeatureId,
  organization,
  source,
  subscription,
}: LandingAnalyticsOptions) {
  const trackViewed = useEffectEvent(() => {
    trackGetsentryAnalytics('business_landing.viewed', {
      organization,
      subscription,
      source,
      initial_feature: highlightedFeatureId || '',
      has_permissions: organization.access.includes('org:billing'),
    });
  });
  const trackClosed = useEffectEvent(() => {
    trackGetsentryAnalytics('business_landing.closed', {
      organization,
      subscription,
      source,
      closing_feature: highlightedFeatureId ?? '',
    });
  });

  useEffect(() => {
    trackViewed();
    return () => trackClosed();
  }, []);
}

export function Details({onCloseModal, organization, source, subscription}: Props) {
  // Frozen at mount so the rotation can't drift from the rendered list if the
  // subscription updates while the modal is open.
  const [features] = useState(() => getFeatures(subscription));
  const imageUrls = useMemo(() => features.map(f => f.image), [features]);

  const {highlightedFeatureId, hasClickedFeature, selectFeature} = useFeatureRotation({
    features,
    initialFeatureId: features.some(f => f.id === source) ? source : null,
    firstDelayMs: FIRST_ROTATE_TIMEOUT,
    intervalMs: ROTATE_INTERVAL,
  });

  useUpsellLandingAnalytics({highlightedFeatureId, organization, source, subscription});
  usePreloadImages(imageUrls);

  const handleFeatureClick = (feature: Feature) => {
    selectFeature(feature);
    trackGetsentryAnalytics('business_landing.clicked', {
      organization,
      subscription,
      source,
      type: `selected ${feature.id}`,
    });
  };

  const highlightedFeature = features.find(feat => feat.id === highlightedFeatureId);
  const {sentences, cta} = getDefaultMessaging(subscription, organization);

  return (
    <Fragment>
      <Grid columns={{zero: '1fr', xl: 'auto 200px'}} gap={{xl: '3xl'}} marginBottom="xl">
        <AnimatePresence initial={false}>
          <FeatureContent
            key={highlightedFeature ? highlightedFeature.id : 'intro'}
            {...featureContentAnimation}
          >
            {highlightedFeature ? (
              <HighlightedFeature
                feature={highlightedFeature}
                organization={organization}
                subscription={subscription}
              />
            ) : (
              <div data-test-id="default-messaging">
                {sentences.map((m, i) => (
                  <p key={i}>{m}</p>
                ))}
                <p>{cta}</p>
              </div>
            )}
          </FeatureContent>
        </AnimatePresence>
        <FeatureList
          features={features}
          selected={highlightedFeature}
          onClick={handleFeatureClick}
          withCountdown={hasClickedFeature ? undefined : ROTATE_INTERVAL}
          shouldShowTeamFeatures={subscription.isFree || subscription.onTrialPlan}
        />
      </Grid>
      <Footer
        subscription={subscription}
        organization={organization}
        onCloseModal={onCloseModal}
        source={source}
      />
    </Fragment>
  );
}

const FeatureContent = styled(motion.div)`
  grid-column: 1;
  grid-row: 1;
`;

const featureContentAnimation = {
  initial: {
    opacity: 0,
    x: -20,
  },
  exit: {
    opacity: 0,
    x: 20,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      delay: 0.02,
    },
  },
};
