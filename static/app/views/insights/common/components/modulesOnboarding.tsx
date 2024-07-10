import {Fragment} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';
import type {PLATFORM_TO_ICON} from 'platformicons/build/platformIcon';

import appStartPreviewImg from 'sentry-images/insights/module-upsells/insights-app-starts-module-charts.svg';
import assetsPreviewImg from 'sentry-images/insights/module-upsells/insights-assets-module-charts.svg';
import cachesPreviewImg from 'sentry-images/insights/module-upsells/insights-caches-module-charts.svg';
import llmPreviewImg from 'sentry-images/insights/module-upsells/insights-llm-module-charts.svg';
import queriesPreviewImg from 'sentry-images/insights/module-upsells/insights-queries-module-charts.svg';
import queuesPreviewImg from 'sentry-images/insights/module-upsells/insights-queues-module-charts.svg';
import requestPreviewImg from 'sentry-images/insights/module-upsells/insights-requests-module-charts.svg';
import screenLoadsPreviewImg from 'sentry-images/insights/module-upsells/insights-screen-loads-module-charts.svg';
import webVitalsPreviewImg from 'sentry-images/insights/module-upsells/insights-web-vitals-module-charts.svg';
import emptyStateImg from 'sentry-images/spot/performance-waiting-for-span.svg';

import {LinkButton} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import type {TitleableModuleNames} from 'sentry/views/insights/common/components/modulePageProviders';
import {useHasFirstSpan} from 'sentry/views/insights/common/queries/useHasFirstSpan';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {MODULE_TITLE} from 'sentry/views/insights/database/settings';
import {
  MODULE_DATA_TYPES,
  MODULE_DATA_TYPES_PLURAL,
  MODULE_PRODUCT_DOC_LINKS,
} from 'sentry/views/insights/settings';
import {ModuleName} from 'sentry/views/insights/types';

type PlatformIcons = keyof typeof PLATFORM_TO_ICON;

export function ModulesOnboarding({
  children,
  moduleName,
  onboardingContent,
}: {
  children: React.ReactNode;
  moduleName: ModuleName;
  onboardingContent?: React.ReactNode;
}) {
  const organization = useOrganization();
  const onboardingProject = useOnboardingProject();
  const hasData = useHasFirstSpan(moduleName);
  const hasEmptyStateFeature = organization.features.includes(
    'insights-empty-state-page'
  );

  if (hasEmptyStateFeature && (onboardingProject || !hasData)) {
    return (
      <ModuleLayout.Full>
        <ModulesOnboardingPanel moduleName={'cache'} />
      </ModuleLayout.Full>
    );
  }

  if (onboardingContent && (onboardingProject || !hasData)) {
    return (
      <ModuleLayout.Full>
        <OldModulesOnboardingPanel>{onboardingContent}</OldModulesOnboardingPanel>
      </ModuleLayout.Full>
    );
  }
  if (!onboardingProject && hasData) {
    return children;
  }
  // TODO: Add an error state?
  return (
    <ModuleLayout.Full>
      <LoadingIndicator />
    </ModuleLayout.Full>
  );
}

function OldModulesOnboardingPanel({children}: {children: React.ReactNode}) {
  return (
    <Panel>
      <Container>
        <ContentContainer>{children}</ContentContainer>
        <PerfImage src={emptyStateImg} />
      </Container>
    </Panel>
  );
}

function ModulesOnboardingPanel({moduleName}: {moduleName: TitleableModuleNames}) {
  const emptyStateContent = EMPTY_STATE_CONTENT[moduleName];

  return (
    <Panel>
      <Container>
        <ContentContainer>
          <Fragment>
            <Header>{emptyStateContent.heading}</Header>
            <p>
              {emptyStateContent.description}{' '}
              <ExternalLink href={MODULE_PRODUCT_DOC_LINKS[moduleName]}>
                {t('Read Docs')}
              </ExternalLink>
            </p>
          </Fragment>
          <SplitContainer>
            <ModulePreview moduleName={moduleName} />
            <ValueProp>
              {emptyStateContent.valuePropDescription}
              <ul>
                {emptyStateContent.valuePropPoints.map(point => (
                  <li key={point?.toString()}>{point}</li>
                ))}
              </ul>
            </ValueProp>
          </SplitContainer>
        </ContentContainer>
        <PerfImage src={emptyStateImg} />
        <LinkButton
          priority="primary"
          external
          href={MODULE_PRODUCT_DOC_LINKS[moduleName]}
        >
          {t('Learn More')}
        </LinkButton>
      </Container>
    </Panel>
  );
}

type ModulePreviewProps = {moduleName: TitleableModuleNames};

function ModulePreview({moduleName}: ModulePreviewProps) {
  const emptyStateContent = EMPTY_STATE_CONTENT[moduleName];
  return (
    <ModulePreviewContainer>
      <ModulePreviewImage src={emptyStateContent.imageSrc} />
      {emptyStateContent.supportedSdks && (
        <SupportedSdkContainer>
          <div>{t('Supporting Today: ')}</div>
          <SupportedSdkList>
            {emptyStateContent.supportedSdks.map(sdk => (
              <SupportedSdkIconContainer key={sdk}>
                <PlatformIcon platform={sdk} size={'25px'} />
              </SupportedSdkIconContainer>
            ))}
          </SupportedSdkList>
        </SupportedSdkContainer>
      )}
    </ModulePreviewContainer>
  );
}

const PerfImage = styled('img')`
  width: 400px;
  user-select: none;
  position: absolute;
  top: 0;
  right: 0;
  padding-right: ${space(2)};
  padding-top: ${space(4)};
`;

const Container = styled('div')`
  position: relative;
  overflow: hidden;
  min-height: 160px;
  padding: ${space(4)};
`;

const ContentContainer = styled('div')`
  position: relative;
  width: 60%;
  z-index: 1;
`;

const Header = styled('h3')`
  margin-bottom: ${space(1)};
`;

const SplitContainer = styled(Panel)`
  display: flex;
  justify-content: center;
`;

const ModulePreviewImage = styled('img')`
  max-width: 100%;
  display: block;
  margin: auto;
  margin-bottom: ${space(2)};
  object-fit: contain;
`;

const ModulePreviewContainer = styled('div')`
  flex: 2;
  width: 100%;
  height: 100%;
  padding: ${space(3)};
  background-color: ${p => p.theme.backgroundSecondary};
`;

const SupportedSdkContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  align-items: center;
  color: ${p => p.theme.gray300};
`;

const SupportedSdkList = styled('div')`
  display: flex;
  gap: ${space(0.5)};
`;

const SupportedSdkIconContainer = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: ${p => p.theme.gray100};
  width: 42px;
  height: 42px;
  border-radius: 3px;
`;

const ValueProp = styled('div')`
  flex: 1;
  padding: ${space(3)};
  ul {
    margin-top: ${space(1)};
  }
`;

type EmptyStateContent = {
  description: React.ReactNode;
  heading: React.ReactNode;
  imageSrc: any;
  valuePropDescription: React.ReactNode;
  valuePropPoints: React.ReactNode[];
  supportedSdks?: PlatformIcons[];
};

const EMPTY_STATE_CONTENT: Record<TitleableModuleNames, EmptyStateContent> = {
  app_start: {
    heading: t(
      'Monitor cold and warm starts and track down the dependency containing the regression. '
    ),
    description: t(
      'Monitor cold and warm starts and track down the operations and releases contributing regression.'
    ),
    valuePropDescription: t(`Mobile App Start insights give you visibility into:`),
    valuePropPoints: [
      t('Application start duration broken down by release.'),
      t('Performance by device class.'),
      t('Real user performance metrics.'),
    ],
    imageSrc: appStartPreviewImg,
  },
  ai: {
    heading: t('TODO'),
    description: t(
      'Get insights into critical LLM metrics, like token usage, to monitor and fix issues with AI pipelines.'
    ),
    valuePropDescription: t('See what your LLMs are doing in production by monitoring:'),
    valuePropPoints: [
      t('Token cost and usage per-provider and per-pipeline.'),
      t('The inputs and outputs of LLM calls.'),
      t('Performance and timing information about LLMs in production.'),
    ],
    imageSrc: llmPreviewImg,
  },
  'mobile-ui': {
    heading: t('TODO'),
    description: t('TODO'),
    valuePropDescription: t('Screen load insights include:'),
    valuePropPoints: [],
    imageSrc: screenLoadsPreviewImg,
  },
  cache: {
    heading: tct('Make Sure Your Application [dataTypePlural] are Behaving Properly', {
      dataTypePlural: MODULE_DATA_TYPES_PLURAL[ModuleName.CACHE],
    }),
    description: t(
      'We’ll tell you if the parts of your application that interact with caches are hitting cache as often as intended, and whether caching is providing the performance improvements expected.'
    ),
    valuePropDescription: tct('[dataType] insights include:', {
      dataType: MODULE_DATA_TYPES[ModuleName.CACHE],
    }),
    valuePropPoints: [
      t('Throughput of your cached endpoints.'),
      t('Average cache hit and miss duration.'),
      t('Hit / miss ratio of keys accessed by your application.'),
    ],
    imageSrc: cachesPreviewImg,
    supportedSdks: [
      'ruby',
      'python',
      'javascript',
      'java',
      'dotnet',
      'php-laravel',
      'php-symfony',
      'python-django',
    ],
  },
  db: {
    heading: t('TODO'),
    description: t(
      'Investigate the performance of database queries and get the information necessary to improve them.'
    ),
    valuePropDescription: t('Query insights give you visibility into:'),
    valuePropPoints: [
      t('Slow queries.'),
      t('High volume queries.'),
      t('Outlier database spans.'),
    ],
    imageSrc: queriesPreviewImg,
  },
  http: {
    heading: t('TODO'),
    description: t(
      'See the outbound HTTP requests being made to internal and external APIs, allowing you to understand trends in status codes, latency, and throughput. '
    ),
    valuePropDescription: tct('[moduleTitle] insights give you visibility into:', {
      moduleTitle: MODULE_TITLE[ModuleName.HTTP],
    }),
    valuePropPoints: [
      t('Anomalies in status codes by domain.'),
      t('Request throughput by domain.'),
      t('Average duration of requests.'),
    ],
    imageSrc: requestPreviewImg,
  },
  resource: {
    heading: t('TODO'),
    description: t(
      'Find large and slow-to-load resources used by your application and understand their impact on page performance.'
    ),
    valuePropDescription: t('Asset insights give you visibility into:'),
    valuePropPoints: [
      t('Asset performance broken down by category and domain.'),
      t('Which routes are loading assets, and whether they’re blocking rendering.'),
      t('Asset size and whether it’s growing over time.'),
    ],
    imageSrc: assetsPreviewImg,
  },
  vital: {
    heading: t(
      'Monitor cold and warm starts and track down the dependency containing the regression. '
    ),
    description: t(
      'App Starts provide insights into your mobile app’s cold start performance:'
    ),
    valuePropDescription: t('Screen load insights include:'),
    valuePropPoints: [
      t('Compare metrics across releases, root causing performance degradations.'),
      t('See performance by device class.'),
      t('Drill down to real user sessions.'),
    ],
    imageSrc: webVitalsPreviewImg,
  },
  queue: {
    heading: t(
      'Monitor cold and warm starts and track down the dependency containing the regression. '
    ),
    description: t(
      'App Starts provide insights into your mobile app’s cold start performance:'
    ),
    valuePropDescription: t('Screen load insights include:'),
    valuePropPoints: [
      t('Compare metrics across releases, root causing performance degradations.'),
      t('See performance by device class.'),
      t('Drill down to real user sessions.'),
    ],
    imageSrc: queuesPreviewImg,
  },
  screen_load: {
    heading: t(
      'Monitor cold and warm starts and track down the dependency containing the regression. '
    ),
    description: t(
      'App Starts provide insights into your mobile app’s cold start performance:'
    ),
    valuePropDescription: t('Screen load insights include:'),
    valuePropPoints: [
      t('Compare metrics across releases, root causing performance degradations.'),
      t('See performance by device class.'),
      t('Drill down to real user sessions.'),
    ],
    imageSrc: screenLoadsPreviewImg,
  },
};
