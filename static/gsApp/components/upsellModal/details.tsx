import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';
import incidentsPerformanceImg from 'getsentry-images/features/alert-builder.svg';
import dashboardsImg from 'getsentry-images/features/dashboards.svg';
import dataRetentionImg from 'getsentry-images/features/data-retention.svg';
import tracingImg from 'getsentry-images/features/distributed-tracing.svg';
import dataVolumeImg from 'getsentry-images/features/event-volume.svg';
import integrationAlerts from 'getsentry-images/features/integration-alerts.svg';
import incidentsImg from 'getsentry-images/features/metric-alerts.svg';
import performanceViewImg from 'getsentry-images/features/perf-summary.svg';
import ssoImg from 'getsentry-images/features/sso.svg';
import userMiseryImg from 'getsentry-images/features/user-misery.svg';

import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import type {Subscription} from 'getsentry/types';
import {getTrialLength, hasPerformance, isTrial} from 'getsentry/utils/billing';
import {trackGetsentryAnalytics} from 'getsentry/utils/trackGetsentryAnalytics';

import {FeatureList} from './featureList';
import {Footer} from './footer';
import {HighlightedFeature} from './highlightedFeature';
import type {Feature} from './types';

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
    id: 'incidents-performance',
    planFeatures: ['incidents', 'performance-view'],
    name: t('Metric Alerts'),
    image: incidentsPerformanceImg,
    desc: tct(
      'Set metric alerts to detect spikes in error count, latency, apdex, failure rate, throughput and more. Assign them to the most relevant teams.',
      {strong: <strong />}
    ),
  },
  {
    id: 'tracing',
    planFeatures: ['performance-view'],
    name: t('Distributed Tracing'),
    image: tracingImg,
    desc: tct(
      'Track the performance of your app to identify N+1 queries, associated errors, or any other bottlenecks, from frontend web vitals to backend API calls.',
      {strong: <strong />}
    ),
  },
  {
    id: 'performance-view',
    planFeatures: ['performance-view'],
    name: t('Transaction Summary'),
    image: performanceViewImg,
    desc: tct(
      "Understand how transactions are doing by percentile, operation, and more. We'll narrow down what's causing slowdowns and link to any related issues.",
      {strong: <strong />}
    ),
  },
  {
    id: 'user-misery',
    planFeatures: ['performance-view'],
    name: t('User Misery and Apdex'),
    image: userMiseryImg,
    desc: tct(
      "Identify how user misery each transaction is causing in your app and where. Prefer to gauge it by Apdex instead? We've got that too.",
      {
        strong: <strong />,
      }
    ),
  },
  {
    id: 'custom-dashboards',
    planFeatures: ['dashboards-edit'],
    name: t('Unlimited Custom Dashboards'),
    image: dashboardsImg,
    desc: tct(
      'Build custom dashboards for your team with a range of rich data visualizations such as histograms, time series, tables, global maps and more.',
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
  'custom-dashboards',
  'sso',
  'integration-alerts',
  'team-roles-upsell',
  'anomaly-detection-alerts',
]).filter(Boolean);

const PERFORMANCE_FEATURES = selectFeatures([
  'tracing',
  'performance-view',
  'discover-query',
  'incidents-performance',
  'custom-dashboards',
  'user-misery',
]).filter(Boolean);

export function Details({onCloseModal, organization, source, subscription}: Props) {
  const shouldShowTeamFeatures = subscription.isFree || subscription.onTrialPlan;

  const features = useMemo<Feature[]>(() => {
    if (hasPerformance(subscription.planDetails)) {
      return shouldShowTeamFeatures
        ? [...BUSINESS_FEATURES, ...TEAM_FEATURES]
        : BUSINESS_FEATURES;
    }
    return PERFORMANCE_FEATURES;
  }, [subscription.planDetails, shouldShowTeamFeatures]);

  const initialHighlightedFeatureId = features.some(f => f.id === source)
    ? source
    : null;

  const [highlightedFeatureId, setHighlightedFeatureId] = useState<string | null>(
    initialHighlightedFeatureId
  );
  const [hasClickedFeature, setHasClickedFeature] = useState(false);

  // Track the latest highlightedFeatureId in a ref so the unmount cleanup
  // can read the current value without re-running the mount effect.
  const highlightedFeatureIdRef = useRef<string | null>(initialHighlightedFeatureId);
  useEffect(() => {
    highlightedFeatureIdRef.current = highlightedFeatureId;
  }, [highlightedFeatureId]);

  const autoRotateTimeoutRef = useRef<number | null>(null);
  const autoRotateIntervalRef = useRef<number | null>(null);

  const stopAutoRotate = useCallback(() => {
    if (autoRotateTimeoutRef.current !== null) {
      clearTimeout(autoRotateTimeoutRef.current);
      autoRotateTimeoutRef.current = null;
    }
    if (autoRotateIntervalRef.current !== null) {
      clearInterval(autoRotateIntervalRef.current);
      autoRotateIntervalRef.current = null;
    }
  }, []);

  const selectFeature = useCallback(
    (feature: Feature) => {
      stopAutoRotate();
      setHighlightedFeatureId(currentId => (feature.id === currentId ? null : feature.id));
      setHasClickedFeature(true);
      trackGetsentryAnalytics('business_landing.clicked', {
        organization,
        subscription,
        source,
        type: `selected ${feature.id}`,
      });
    },
    [stopAutoRotate, organization, subscription, source]
  );

  useEffect(() => {
    trackGetsentryAnalytics('business_landing.viewed', {
      organization,
      subscription,
      source,
      initial_feature: highlightedFeatureIdRef.current || '',
      has_permissions: organization.access.includes('org:billing'),
    });

    features.forEach(feat => {
      const img = new Image();
      img.src = feat.image;
    });

    const showNextFeature = () => {
      setHighlightedFeatureId(currentId => {
        const featureIds = features.map(f => f.id);
        const nextIndex = currentId ? featureIds.indexOf(currentId) + 1 : 0;
        return featureIds[nextIndex % features.length]!;
      });
    };

    const firstAutoRotate = () => {
      showNextFeature();
      autoRotateIntervalRef.current = window.setInterval(showNextFeature, ROTATE_INTERVAL);
    };
    autoRotateTimeoutRef.current = window.setTimeout(firstAutoRotate, FIRST_ROTATE_TIMEOUT);

    return () => {
      trackGetsentryAnalytics('business_landing.closed', {
        organization,
        subscription,
        source,
        closing_feature: highlightedFeatureIdRef.current ?? '',
      });
      stopAutoRotate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const highlightedFeature = features.find(feat => feat.id === highlightedFeatureId);

  const sentences = isTrial(subscription)
    ? // If the subscription already has performance
      hasPerformance(subscription.planDetails)
      ? [
          t(
            `With your trial you have access to Sentry's Power Features, which
             offer a macro-level perspective of error trends and application
             health, while also allowing you to drill down into a single
             issue or event with Dashboards and Discover-powered queries.`
          ),
          t(
            `We hope you're enjoying these new features to create complex
             queries against event data, see all issues across projects, and
             view dashboards for a comprehensive and holistic view.`
          ),
        ]
      : [
          t(
            `With your trial you have access to Sentry's Performance Monitoring
             features which give you deeper visibility into your frontend page
             load times and database queries that are critical toward
             delivering fast customer experiences.`
          ),
          t(
            `With just five lines of code, you're now able to highlight your
             key transactions and set metric alerts to detect latency spikes.
             You can also dive in and query across multiple projects for a
             comprehensive view into your application.`
          ),
        ]
    : hasPerformance(subscription.planDetails)
      ? [
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
        ]
      : [
          t(
            `We added a bunch of new features that made Sentry a whole lot better.
           If we do say so ourselves.`
          ),
          t(
            `To get more out of Sentry and life in general, switch over to our new and
           improved Performance Plans. You'll get transactions, attachments, access to
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
      : hasPerformance(subscription.planDetails)
        ? tct('Upgrade to our [strong:Business Plan] today.', {strong: <strong />})
        : tct(
            "You're currently on one of our legacy plans. Upgrade to our newer [strong:Performance Plans].",
            {strong: <strong />}
          );

  const orgSub = {organization, subscription};

  return (
    <Fragment>
      <MainUpsell>
        <AnimatePresence initial={false}>
          <FeatureContent
            key={highlightedFeature ? highlightedFeature.id : 'intro'}
            {...featureContentAnimation}
          >
            {highlightedFeature ? (
              <HighlightedFeature feature={highlightedFeature} {...orgSub} />
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
          onClick={selectFeature}
          withCountdown={hasClickedFeature ? undefined : ROTATE_INTERVAL}
          shouldShowTeamFeatures={shouldShowTeamFeatures}
          shouldShowPerformanceFeatures={!hasPerformance(subscription.planDetails)}
          {...orgSub}
        />
      </MainUpsell>
      <Footer
        subscription={subscription}
        organization={organization}
        onCloseModal={onCloseModal}
        source={source}
      />
    </Fragment>
  );
}

const MainUpsell = styled('div')`
  display: grid;
  font-size: ${p => p.theme.font.size.md};
  margin-bottom: ${p => p.theme.space.xl};

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: auto 200px;
    gap: ${p => p.theme.space['3xl']};
  }
`;

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
