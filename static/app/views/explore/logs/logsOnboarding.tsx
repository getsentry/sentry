import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import connectDotsImg from 'sentry-images/spot/performance-connect-dots.svg';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {ContentBlocksRenderer} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/renderer';
import {
  OnboardingCodeSnippet,
  TabbedCodeSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';
import type {
  Configuration,
  ContentBlock,
  DocsParams,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  ProductSolution,
  StepType,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useSourcePackageRegistries} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import {useLoadGettingStarted} from 'sentry/components/onboarding/gettingStartedDoc/utils/useLoadGettingStarted';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {BodyTitle, SetupTitle} from 'sentry/components/updatedEmptyState';
import {withoutLoggingSupport} from 'sentry/data/platformCategories';
import platforms, {otherPlatform} from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventWaiter from 'sentry/utils/eventWaiter';
import {decodeInteger} from 'sentry/utils/queryString';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {LOGS_QUERY_KEY} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {Tab} from 'sentry/views/explore/hooks/useTab';
import {
  FilterBarContainer,
  StyledPageFilterBar,
  TopSectionBody,
} from 'sentry/views/explore/logs/styles';
import {useLogsQuery} from 'sentry/views/explore/logs/useLogsQuery';
import type {PickableDays} from 'sentry/views/explore/utils';

type SampleButtonProps = {
  api: Client;
  errorMessage: React.ReactNode;
  loadingMessage: React.ReactNode;
  organization: Organization;
  project: Project;
  triggerText: React.ReactNode;
};

function SampleButton({
  triggerText,
  loadingMessage,
  errorMessage,
  project,
  organization,
  api,
}: SampleButtonProps) {
  const navigate = useNavigate();
  // TODO: Fix this to create a sample log
  return (
    <Button
      data-test-id="create-sample-transaction-btn"
      onClick={async () => {
        trackAnalytics('logs.onboarding_create_sample_log', {
          platform: project.platform,
          organization,
        });
        addLoadingMessage(loadingMessage, {
          duration: 15000,
        });
        const url = `/projects/${organization.slug}/${project.slug}/create-sample-log/`;
        try {
          const eventData = await api.requestPromise(url, {method: 'POST'});
          // TODO: Update with logs url function with item id / trace id
          const traceSlug = eventData.contexts?.trace?.trace_id ?? '';

          navigate({
            pathname: '/explore/logs/',
            query: {
              [LOGS_QUERY_KEY]: `trace:${traceSlug}`,
            },
          });
          clearIndicators();
        } catch (error) {
          Sentry.withScope(scope => {
            scope.setExtra('error', error);
            Sentry.captureException(new Error('Failed to create sample log'));
          });
          clearIndicators();
          addErrorMessage(errorMessage);
          return;
        }
      }}
    >
      {triggerText}
    </Button>
  );
}

type OnboardingProps = {
  organization: Organization;
  project: Project;
};

function ConfigurationRenderer({configuration}: {configuration: Configuration}) {
  const subConfigurations = configuration.configurations ?? [];
  return (
    <ConfigurationWrapper>
      {configuration.description && (
        <DescriptionWrapper>{configuration.description}</DescriptionWrapper>
      )}
      {configuration.code ? (
        Array.isArray(configuration.code) ? (
          <TabbedCodeSnippet tabs={configuration.code} />
        ) : (
          <OnboardingCodeSnippet language={configuration.language}>
            {configuration.code}
          </OnboardingCodeSnippet>
        )
      ) : null}
      {subConfigurations.map((subConfiguration, index) => (
        <ConfigurationRenderer key={index} configuration={subConfiguration} />
      ))}
      {configuration.additionalInfo && (
        <AdditionalInfo>{configuration.additionalInfo}</AdditionalInfo>
      )}
    </ConfigurationWrapper>
  );
}

function RenderBlocksOrFallback({
  contentBlocks,
  children,
}: {
  children: React.ReactNode;
  contentBlocks?: ContentBlock[];
}) {
  if (contentBlocks && contentBlocks.length > 0) {
    return <ContentBlocksRenderer spacing={space(1)} contentBlocks={contentBlocks} />;
  }
  return children;
}

function OnboardingPanel({
  project,
  children,
}: {
  children: React.ReactNode;
  project: Project;
}) {
  return (
    <Panel>
      <PanelBody>
        <AuthTokenGeneratorProvider projectSlug={project?.slug}>
          <div>
            <HeaderWrapper>
              <HeaderText>
                <Title>{t('Your Source for Log-ical Data')}</Title>
                <SubTitle>
                  {t(
                    "It's about time we offered something a bit more robust than breadcrumbs. With logs, you'll be able to have a lot more control and context over all your data."
                  )}
                </SubTitle>
                <BulletList>
                  <li>{t('Access logs in real time and query them by any attribute')}</li>
                  <li>
                    {t('Correlate your logs with errors and traces for full context')}
                  </li>
                  <li>{t('Build alerts and dashboard widgets based on log queries')}</li>
                </BulletList>
              </HeaderText>
              <Image src={connectDotsImg} />
            </HeaderWrapper>
            <Divider />
            <Body>
              <Setup>{children}</Setup>
              <Preview>
                <BodyTitle>{t('Preview a Sentry Log')}</BodyTitle>
                <Arcade
                  src="https://app.arcade.software/dLjHGrPJITrt7JKpmX5V?embed"
                  loading="lazy"
                  allowFullScreen
                />
              </Preview>
            </Body>
          </div>
        </AuthTokenGeneratorProvider>
      </PanelBody>
    </Panel>
  );
}

const STEP_TITLES: Record<StepType, string> = {
  [StepType.INSTALL]: t('Install Sentry'),
  [StepType.CONFIGURE]: t('Configure Sentry'),
  [StepType.VERIFY]: t('Verify Sentry'),
};

function Onboarding({organization, project}: OnboardingProps) {
  const api = useApi();
  const location = useLocation();
  const navigate = useNavigate();
  const {isSelfHosted, urlPrefix} = useLegacyStore(ConfigStore);
  const [received, setReceived] = useState<boolean>(false);
  const logsQuery = useLogsQuery({
    disabled: !received,
    limit: 1,
    refetchInterval: query => {
      const logId = query.state.data?.[0]?.data?.[0]?.id;
      return logId ? 0 : 5000; // 5s
    },
  });
  const logId = logsQuery.data?.[0]?.id;

  const currentPlatform = project.platform
    ? platforms.find(p => p.id === project.platform)
    : undefined;

  const {isLoading, docs, dsn, projectKeyId} = useLoadGettingStarted({
    platform: currentPlatform || otherPlatform,
    orgSlug: organization.slug,
    projSlug: project.slug,
    productType: 'logs',
  });

  const {isPending: isLoadingRegistry, data: registryData} =
    useSourcePackageRegistries(organization);

  const doesNotSupportLogging = project.platform
    ? withoutLoggingSupport.has(project.platform)
    : false;

  const analyticsPlatform = currentPlatform?.id ?? project.platform ?? 'unknown';

  useEffect(() => {
    if (isLoading || !currentPlatform || !dsn || !projectKeyId) {
      return;
    }

    trackAnalytics('logs.onboarding', {
      organization,
      platform: analyticsPlatform,
      supports_onboarding_checklist: !doesNotSupportLogging,
    });
  }, [
    currentPlatform,
    isLoading,
    dsn,
    projectKeyId,
    organization,
    doesNotSupportLogging,
    analyticsPlatform,
  ]);

  const logsDocs = docs?.onboarding;

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (doesNotSupportLogging) {
    return (
      <OnboardingPanel project={project}>
        <div>
          {tct(
            'Fiddlesticks. Application Logging isn’t available for your [platform] project yet, but we’re definitely still working on it. Stay tuned.',
            {platform: currentPlatform?.name || project.slug}
          )}
        </div>
        <br />
        <div>
          <LinkButton
            size="sm"
            href="https://docs.sentry.io/platforms/"
            external
            onClick={() => {
              trackAnalytics('logs.onboarding_platform_docs_viewed', {
                organization,
                platform: analyticsPlatform,
              });
            }}
          >
            {t('Go to Documentation')}
          </LinkButton>
        </div>
      </OnboardingPanel>
    );
  }

  if (!currentPlatform || !logsDocs || !dsn || !projectKeyId) {
    return (
      <OnboardingPanel project={project}>
        <div>
          {tct(
            'Fiddlesticks. The logging onboarding checklist isn’t available for your [project] project yet, but for now, go to Sentry docs for installation details.',
            {project: project.slug}
          )}
        </div>
        <br />
        <div>
          <LinkButton
            size="sm"
            href="https://docs.sentry.io/product/explore/logs/getting-started/"
            external
            onClick={() => {
              trackAnalytics('logs.onboarding_platform_docs_viewed', {
                organization,
                platform: analyticsPlatform,
              });
            }}
          >
            {t('Go to Documentation')}
          </LinkButton>
        </div>
      </OnboardingPanel>
    );
  }

  const docParams: DocsParams<any> = {
    api,
    projectKeyId,
    dsn,
    organization,
    platformKey: project.platform || 'other',
    project,
    isLogsSelected: true,
    isFeedbackSelected: false,
    isPerformanceSelected: false,
    isProfilingSelected: false,
    isReplaySelected: false,
    sourcePackageRegistries: {
      isLoading: isLoadingRegistry,
      data: registryData,
    },
    platformOptions: [ProductSolution.LOGS],
    newOrg: false,
    feedbackOptions: {},
    urlPrefix,
    isSelfHosted,
  };

  const installSteps = logsDocs.install(docParams);
  const configureSteps = logsDocs.configure(docParams);
  const verifySteps = logsDocs.verify(docParams);

  const steps = [...installSteps, ...configureSteps, ...verifySteps];

  const eventWaitingIndicator = (
    <EventWaiter
      api={api}
      organization={organization}
      project={project}
      eventType="log"
      onIssueReceived={() => {
        setReceived(true);
      }}
    >
      {({firstIssue}) =>
        firstIssue ? <EventReceivedIndicator /> : <EventWaitingIndicator />
      }
    </EventWaiter>
  );

  return (
    <OnboardingPanel project={project}>
      <SetupTitle project={project} />
      <GuidedSteps
        initialStep={decodeInteger(location.query.guidedStep)}
        onStepChange={step => {
          navigate({
            pathname: location.pathname,
            query: {
              ...location.query,
              guidedStep: step,
            },
          });
        }}
      >
        {steps.map((step, index) => {
          const title = step.title ?? STEP_TITLES[step.type];
          return (
            <GuidedSteps.Step key={title} stepKey={title} title={title}>
              <RenderBlocksOrFallback contentBlocks={step.content}>
                <ConfigurationRenderer configuration={step} />
              </RenderBlocksOrFallback>
              {index === steps.length - 1 ? (
                <Fragment>
                  {eventWaitingIndicator}
                  <GuidedSteps.ButtonWrapper>
                    <GuidedSteps.BackButton size="md" />
                    {received ? (
                      <Button
                        priority="primary"
                        busy={!logId}
                        title={logId ? undefined : t('Processing logs\u2026')}
                        onClick={() => {
                          const params = new URLSearchParams(window.location.search);
                          params.set('table', Tab.TRACE);
                          params.set('query', `trace:${logId}`);
                          params.delete('guidedStep');
                          testableWindowLocation.assign(
                            `${window.location.pathname}?${params.toString()}`
                          );
                        }}
                      >
                        {t('Take me to my logs')}
                      </Button>
                    ) : (
                      <SampleButton
                        triggerText={t('Take me to an example log')}
                        loadingMessage={t('Processing sample logs...')}
                        errorMessage={t('Failed to create sample logs')}
                        organization={organization}
                        project={project}
                        api={api}
                      />
                    )}
                  </GuidedSteps.ButtonWrapper>
                </Fragment>
              ) : (
                <GuidedSteps.ButtonWrapper>
                  <GuidedSteps.BackButton size="md" />
                  <GuidedSteps.NextButton size="md" />
                </GuidedSteps.ButtonWrapper>
              )}
            </GuidedSteps.Step>
          );
        })}
      </GuidedSteps>
    </OnboardingPanel>
  );
}

const EventWaitingIndicator = styled((p: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...p}>
    {t("Waiting for this project's first log")}
    <PulsingIndicator />
  </div>
))`
  display: flex;
  align-items: center;
  position: relative;
  z-index: 10;
  flex-grow: 1;
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.pink400};
`;

const PulsingIndicator = styled('div')`
  ${pulsingIndicatorStyles};
  margin-left: ${space(1)};
`;

const EventReceivedIndicator = styled((p: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...p}>
    {'🎉 '}
    {t("We've received this project's first log!")}
  </div>
))`
  display: flex;
  align-items: center;
  flex-grow: 1;
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.successText};
`;

const SubTitle = styled('div')`
  margin-bottom: ${space(1)};
`;

const Title = styled('div')`
  font-size: 26px;
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const BulletList = styled('ul')`
  list-style-type: disc;
  padding-left: 20px;
  margin-bottom: ${space(2)};

  li {
    margin-bottom: ${space(1)};
  }
`;

const HeaderWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(3)};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(4)};
`;

const HeaderText = styled('div')`
  flex: 0.65;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    flex: 1;
  }
`;

const Setup = styled('div')`
  padding: ${space(4)};

  &:after {
    content: '';
    position: absolute;
    right: 50%;
    top: 2.5%;
    height: 95%;
    border-right: 1px ${p => p.theme.border} solid;
  }
`;

const Preview = styled('div')`
  padding: ${space(4)};
`;

const Body = styled('div')`
  display: grid;
  position: relative;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;

  h4 {
    margin-bottom: 0;
  }
`;

const Image = styled('img')`
  display: block;
  pointer-events: none;
  height: 120px;
  overflow: hidden;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: none;
  }
`;

const Divider = styled('hr')`
  height: 1px;
  width: 95%;
  background: ${p => p.theme.border};
  border: none;
  margin-top: 0;
  margin-bottom: 0;
`;

const Arcade = styled('iframe')`
  width: 750px;
  max-width: 100%;
  margin-top: ${space(3)};
  height: 522px;
  border: 0;
`;

const CONTENT_SPACING = space(1);

const ConfigurationWrapper = styled('div')`
  margin-bottom: ${CONTENT_SPACING};
`;

const DescriptionWrapper = styled('div')`
  code:not([class*='language-']) {
    color: ${p => p.theme.pink400};
  }

  :not(:last-child) {
    margin-bottom: ${CONTENT_SPACING};
  }

  && > h4,
  && > h5,
  && > h6 {
    font-size: ${p => p.theme.fontSize.xl};
    font-weight: ${p => p.theme.fontWeight.bold};
    line-height: 34px;
  }

  && > * {
    margin: 0;
    &:not(:last-child) {
      margin-bottom: ${CONTENT_SPACING};
    }
  }
`;

const AdditionalInfo = styled(DescriptionWrapper)`
  margin-top: ${CONTENT_SPACING};
`;
type LogsTabOnboardingProps = {
  organization: Organization;
  project: Project;
} & PickableDays;

export function LogsTabOnboarding({
  organization,
  project,
  defaultPeriod,
  maxPickableDays,
  relativeOptions,
}: LogsTabOnboardingProps) {
  return (
    <TopSectionBody noRowGap>
      <Layout.Main fullWidth>
        <FilterBarContainer>
          <StyledPageFilterBar condensed>
            <ProjectPageFilter />
            <EnvironmentPageFilter />
            <DatePageFilter
              defaultPeriod={defaultPeriod}
              maxPickableDays={maxPickableDays}
              relativeOptions={relativeOptions}
            />
          </StyledPageFilterBar>
        </FilterBarContainer>
        <Onboarding project={project} organization={organization} />
      </Layout.Main>
    </TopSectionBody>
  );
}
