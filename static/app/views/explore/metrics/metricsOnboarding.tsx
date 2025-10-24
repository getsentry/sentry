import {useEffect} from 'react';
import styled from '@emotion/styled';

import connectDotsImg from 'sentry-images/spot/performance-connect-dots.svg';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {ContentBlocksRenderer} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/renderer';
import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
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
import {withoutMetricsSupport} from 'sentry/data/platformCategories';
import platforms, {otherPlatform} from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeInteger} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {
  FilterBarContainer,
  StyledPageFilterBar,
  TopSectionBody,
} from 'sentry/views/explore/metrics/styles';
import type {PickableDays} from 'sentry/views/explore/utils';

type OnboardingProps = {
  organization: Organization;
  project: Project;
};

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
                <Title>{t('Measure What Matters with Metrics')}</Title>
                <SubTitle>
                  {t(
                    'Track custom business metrics and monitor application performance with powerful aggregation and visualization capabilities.'
                  )}
                </SubTitle>
                <BulletList>
                  <li>
                    {t(
                      'Send custom metrics to track business KPIs and technical indicators'
                    )}
                  </li>
                  <li>
                    {t(
                      'Create dashboards and alerts based on metric queries and aggregations'
                    )}
                  </li>
                  <li>
                    {t(
                      'Analyze metrics alongside errors, traces, and logs for full context'
                    )}
                  </li>
                </BulletList>
              </HeaderText>
              <Image src={connectDotsImg} />
            </HeaderWrapper>
            <Divider />
            <Body>
              <Setup>{children}</Setup>
              <Preview>
                <BodyTitle>{t('Preview a Sentry Metric')}</BodyTitle>
                <Arcade
                  src="https://demo.arcade.software/dLjHGrPJITrt7JKpmX5V?embed"
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
  const currentPlatform = project.platform
    ? platforms.find(p => p.id === project.platform)
    : undefined;

  const {isLoading, docs, dsn, projectKeyId} = useLoadGettingStarted({
    platform: currentPlatform || otherPlatform,
    orgSlug: organization.slug,
    projSlug: project.slug,
    productType: 'metrics',
  });

  const {isPending: isLoadingRegistry, data: registryData} =
    useSourcePackageRegistries(organization);

  const doesNotSupportMetrics = project.platform
    ? withoutMetricsSupport.has(project.platform)
    : false;

  const analyticsPlatform = currentPlatform?.id ?? project.platform ?? 'unknown';

  useEffect(() => {
    if (isLoading || !currentPlatform || !dsn || !projectKeyId) {
      return;
    }

    trackAnalytics('metrics.onboarding', {
      organization,
      platform: analyticsPlatform,
      supports_onboarding_checklist: !doesNotSupportMetrics,
    });
  }, [
    currentPlatform,
    isLoading,
    dsn,
    projectKeyId,
    organization,
    doesNotSupportMetrics,
    analyticsPlatform,
  ]);

  const metricsDocs = docs?.metricsOnboarding ?? docs?.onboarding;

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (doesNotSupportMetrics) {
    return (
      <OnboardingPanel project={project}>
        <div>
          {tct(
            "Fiddlesticks. Metrics isn't available for your [platform] project yet, but we're definitely still working on it. Stay tuned.",
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
              trackAnalytics('metrics.onboarding_platform_docs_viewed', {
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

  if (!currentPlatform || !metricsDocs || !dsn || !projectKeyId) {
    return (
      <OnboardingPanel project={project}>
        <div>
          {tct(
            "Fiddlesticks. The metrics onboarding checklist isn't available for your [project] project yet, but for now, go to Sentry docs for installation details.",
            {project: project.slug}
          )}
        </div>
        <br />
        <div>
          <LinkButton
            size="sm"
            href="https://docs.sentry.io/product/metrics/"
            external
            onClick={() => {
              trackAnalytics('metrics.onboarding_platform_docs_viewed', {
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
    isLogsSelected: false,
    isMetricsSelected: true,
    isFeedbackSelected: false,
    isPerformanceSelected: false,
    isProfilingSelected: false,
    isReplaySelected: false,
    sourcePackageRegistries: {
      isLoading: isLoadingRegistry,
      data: registryData,
    },
    platformOptions: [ProductSolution.METRICS],
    newOrg: false,
    feedbackOptions: {},
    urlPrefix,
    isSelfHosted,
  };

  const installSteps = metricsDocs.install(docParams);
  const configureSteps = metricsDocs.configure(docParams);
  const verifySteps = metricsDocs.verify(docParams);

  const steps = [...installSteps, ...configureSteps, ...verifySteps];

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
              <ContentBlocksRenderer spacing={space(1)} contentBlocks={step.content} />
              {index === steps.length - 1 ? (
                <GuidedSteps.ButtonWrapper>
                  <GuidedSteps.BackButton size="md" />
                </GuidedSteps.ButtonWrapper>
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

type MetricsTabOnboardingProps = {
  organization: Organization;
  project: Project;
} & PickableDays;

export function MetricsTabOnboarding({
  organization,
  project,
  defaultPeriod,
  maxPickableDays,
  relativeOptions,
}: MetricsTabOnboardingProps) {
  return (
    <TopSectionBody noRowGap>
      <Layout.Main width="full">
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
