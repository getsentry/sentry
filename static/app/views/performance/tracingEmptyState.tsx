import {type ReactNode, useEffect} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import {createSerializer, parseAsInteger, parseAsString} from 'nuqs';
import {useStore} from 'zustand';
import {useShallow} from 'zustand/react/shallow';

import emptyTraceImg from 'sentry-images/spot/performance-empty-trace.svg';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Image} from '@sentry/scraps/image';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useSourcePackageRegistries} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import {useLoadGettingStarted} from 'sentry/components/onboarding/gettingStartedDoc/utils/useLoadGettingStarted';
import {ManualSetupSteps} from 'sentry/components/productEmptyState/manualSetupSteps';
import {ProductEmptyState} from 'sentry/components/productEmptyState/productEmptyState';
import {
  withoutPerformanceSupport,
  withPerformanceOnboarding,
} from 'sentry/data/platformCategories';
import {otherPlatform, allPlatforms as platforms} from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {pulsingIndicatorStyles} from 'sentry/styles/pulsingIndicator';
import type {Organization} from 'sentry/types/organization';
import type {PlatformIntegration, Project, ProjectKey} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {useApi} from 'sentry/utils/useApi';
import {useEventWaiter} from 'sentry/utils/useEventWaiter';
import {Tab} from 'sentry/views/explore/hooks/useTab';
import {useTracesApiOptions} from 'sentry/views/explore/hooks/useTraces';

import {traceAnalytics} from './traceDetails/traceAnalytics';

const TRACING_BENEFITS = [
  t('See related errors, logs, replays, and metrics alongside each trace'),
  t(
    'Find slow services and operations in the trace view and spot where a problem originated'
  ),
  t('Inspect model calls and tool calls in AI agents'),
];

const TRACING_AGENT_STEPS = [
  t('Install or update the Sentry SDK with tracing support'),
  t('Configure the tracing sample rate and SDK options'),
  t('Send a test request and verify traces appear in Sentry'),
];

const PLATFORM_DOCS_URL = 'https://docs.sentry.io/platforms/';
const TRACE_EXPLORER_DOCS_URL = 'https://docs.sentry.io/product/trace-explorer/';

const serializeTraceRedirect = createSerializer({
  table: parseAsString,
  query: parseAsString,
  guidedStep: parseAsInteger,
});

function TakeMeToTraceButton({traceId}: {traceId: string | undefined}) {
  return (
    <Button
      variant="primary"
      busy={!traceId}
      tooltipProps={{title: traceId ? undefined : t('Processing trace\u2026')}}
      onClick={() => {
        testableWindowLocation.assign(
          serializeTraceRedirect(`${window.location.pathname}${window.location.search}`, {
            table: Tab.TRACE,
            query: `trace:${traceId}`,
            guidedStep: null,
          })
        );
      }}
    >
      {t('Take me to my trace')}
    </Button>
  );
}

function doesNotSupportPerformance(project: Project): boolean {
  return project.platform ? withoutPerformanceSupport.has(project.platform) : false;
}

interface DocsFallbackProps {
  children: ReactNode;
  href: string;
  onClick: () => void;
}

function DocsFallback({href, onClick, children}: DocsFallbackProps) {
  return (
    <Stack gap="md">
      <Text>{children}</Text>
      <div>
        <LinkButton size="sm" href={href} external onClick={onClick}>
          {t('Go to Documentation')}
        </LinkButton>
      </div>
    </Stack>
  );
}

interface TracingManualSetupProps {
  currentPlatform: PlatformIntegration | undefined;
  dsn: ProjectKey['dsn'] | undefined;
  noPerformanceSupport: boolean;
  organization: Organization;
  performanceDocs: OnboardingConfig | undefined;
  project: Project;
  projectKeyId: string | undefined;
}

function TracingManualSetup({
  currentPlatform,
  dsn,
  noPerformanceSupport,
  organization,
  performanceDocs,
  project,
  projectKeyId,
}: TracingManualSetupProps) {
  const api = useApi();
  const {isSelfHosted, urlPrefix} = useStore(
    ConfigStore,
    useShallow(state => ({isSelfHosted: state.isSelfHosted, urlPrefix: state.urlPrefix}))
  );
  const {isPending: isLoadingRegistry, data: registryData} =
    useSourcePackageRegistries(organization);

  const platformName = currentPlatform?.name ?? project.slug;
  const platformId = currentPlatform?.id ?? project.platform ?? 'unknown';

  if (noPerformanceSupport) {
    return (
      <DocsFallback
        href={PLATFORM_DOCS_URL}
        onClick={() => traceAnalytics.trackPlatformDocsViewed(organization, platformId)}
      >
        {tct(
          'Fiddlesticks. Performance isn\u2019t available for your [platform] project yet but we\u2019re definitely still working on it. Stay tuned.',
          {platform: platformName}
        )}
      </DocsFallback>
    );
  }

  if (!currentPlatform || !performanceDocs || !dsn || !projectKeyId) {
    return (
      <DocsFallback
        href={TRACE_EXPLORER_DOCS_URL}
        onClick={() =>
          traceAnalytics.trackPerformanceSetupDocsViewed(organization, platformId)
        }
      >
        {tct('Read the docs to instrument tracing in your [platform] project', {
          platform: platformName,
        })}
      </DocsFallback>
    );
  }

  const docParams: DocsParams<any> = {
    api,
    projectKeyId,
    dsn,
    organization,
    platformKey: project.platform || 'other',
    project,
    isLogsSelected: false,
    isFeedbackSelected: false,
    isMetricsSelected: false,
    isPerformanceSelected: true,
    isProfilingSelected: false,
    isReplaySelected: false,
    sourcePackageRegistries: {isLoading: isLoadingRegistry, data: registryData},
    platformOptions: [ProductSolution.PERFORMANCE_MONITORING],
    feedbackOptions: {},
    urlPrefix,
    isSelfHosted,
  };

  const tracingSteps = [
    ...performanceDocs.install(docParams),
    ...performanceDocs.configure(docParams),
    ...performanceDocs.verify(docParams),
  ];

  return (
    <ManualSetupSteps
      project={project}
      steps={tracingSteps}
      copyMarkdownSource="performance_onboarding"
    />
  );
}

type Props = {
  organization: Organization;
  project: Project;
};

export function TracingEmptyState({organization, project}: Props) {
  const noPerformanceSupport = doesNotSupportPerformance(project);

  const firstIssue = useEventWaiter({
    eventType: 'transaction',
    organization,
    project,
    disabled: noPerformanceSupport,
  });
  const received = !!firstIssue;

  const tracesQuery = useQuery({
    ...useTracesApiOptions({limit: 1, sort: 'timestamp'}),
    enabled: received,
    refetchInterval: query => {
      const trace = query.state.data?.json?.data?.[0]?.trace;
      return trace ? false : 5000;
    },
  });
  const traceId = tracesQuery.data?.data[0]?.trace;

  const currentPlatform = project.platform
    ? platforms.find(p => p.id === project.platform)
    : undefined;

  const {isLoading, docs, dsn, projectKeyId} = useLoadGettingStarted({
    platform: currentPlatform || otherPlatform,
    orgSlug: organization.slug,
    projSlug: project.slug,
    productType: 'performance',
  });

  useEffect(() => {
    if (isLoading || !currentPlatform || !dsn || !projectKeyId) {
      return;
    }
    traceAnalytics.trackTracingOnboarding(
      organization,
      currentPlatform.id,
      !noPerformanceSupport,
      withPerformanceOnboarding.has(currentPlatform.id)
    );
  }, [currentPlatform, isLoading, dsn, projectKeyId, organization, noPerformanceSupport]);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  const footer = noPerformanceSupport ? undefined : (
    <Flex align="center" justify="between" gap="md">
      {received ? <EventReceivedIndicator /> : <EventWaitingIndicator />}
      {received && <TakeMeToTraceButton traceId={traceId} />}
    </Flex>
  );

  return (
    <Container column="1 / -1">
      <ProductEmptyState
        title={t('Tracing in Sentry')}
        benefits={TRACING_BENEFITS}
        media={
          <Container pointerEvents="none">
            <Image
              src={emptyTraceImg}
              alt={t(
                'A winged insect flying above a tilted browser window with abstract interface elements'
              )}
              height="160px"
              width="auto"
            />
          </Container>
        }
        agentSteps={TRACING_AGENT_STEPS}
        product="tracing"
        productName={t('Tracing')}
        project={project}
        feedbackSource="traces-onboarding"
        manualSetup={
          <TracingManualSetup
            currentPlatform={currentPlatform}
            dsn={dsn}
            noPerformanceSupport={noPerformanceSupport}
            organization={organization}
            performanceDocs={docs?.performanceOnboarding}
            project={project}
            projectKeyId={projectKeyId}
          />
        }
        onPromptCopied={_handoffId => {
          trackAnalytics('onboarding.ai_prompt_copied', {
            organization,
            platform: project.platform ?? 'unknown',
            product: 'traces',
            source: 'prompt',
          });
        }}
        footer={footer}
      />
    </Container>
  );
}

const EventWaitingIndicator = styled((p: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...p}>
    {t("Waiting for this project's first trace")}
    <PulsingIndicator />
  </div>
))`
  display: flex;
  align-items: center;
  flex-grow: 1;
  font-size: ${p => p.theme.font.size.md};
  color: ${p => p.theme.colors.pink500};
`;

const PulsingIndicator = styled('div')`
  ${pulsingIndicatorStyles};
  margin-left: ${p => p.theme.space.md};
  flex-shrink: 0;
`;

const EventReceivedIndicator = styled((p: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...p}>
    {'🎉 '}
    {t("We've received this project's first trace!")}
  </div>
))`
  display: flex;
  align-items: center;
  flex-grow: 1;
  font-size: ${p => p.theme.font.size.md};
  color: ${p => p.theme.tokens.content.success};
`;
