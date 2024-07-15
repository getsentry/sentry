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
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import type {TitleableModuleNames} from 'sentry/views/insights/common/components/modulePageProviders';
import {useHasFirstSpan} from 'sentry/views/insights/common/queries/useHasFirstSpan';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
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
        <ModulesOnboardingPanel moduleName={moduleName} />
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

  if (!onboardingContent) {
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

function ModulesOnboardingPanel({moduleName}: {moduleName: ModuleName}) {
  const emptyStateContent = EMPTY_STATE_CONTENT[moduleName];

  return (
    <Panel>
      <Container>
        <ContentContainer>
          <Fragment>
            <Header>{emptyStateContent.heading}</Header>
            <p>{emptyStateContent.description}</p>
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
          {t('Read the docs')}
        </LinkButton>
      </Container>
    </Panel>
  );
}

type ModulePreviewProps = {moduleName: ModuleName};

function ModulePreview({moduleName}: ModulePreviewProps) {
  const emptyStateContent = EMPTY_STATE_CONTENT[moduleName];
  return (
    <ModulePreviewContainer>
      <ModulePreviewImage src={emptyStateContent.imageSrc} />
      {emptyStateContent.supportedSdks && (
        <SupportedSdkContainer>
          <div>{t('Supported Today: ')}</div>
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
    heading: t('Don’t lose the race at the starting line'),
    description: tct(
      'Monitor cold and warm [dataTypePlural] and track down the operations and releases contributing regression.',
      {
        dataTypePlural:
          MODULE_DATA_TYPES_PLURAL[ModuleName.APP_START].toLocaleLowerCase(),
      }
    ),
    valuePropDescription: tct(`Mobile [dataType] insights give you visibility into:`, {
      dataType: MODULE_DATA_TYPES[ModuleName.APP_START],
    }),
    valuePropPoints: [
      t('Application start duration broken down by release.'),
      t('Performance by device class.'),
      t('Real user performance metrics.'),
    ],
    imageSrc: appStartPreviewImg,
  },
  ai: {
    heading: t('Find out what your LLM model is actually saying'),
    description: tct(
      'Get insights into critical [dataType] metrics, like token usage, to monitor and fix issues with AI pipelines.',
      {
        dataType: MODULE_DATA_TYPES[ModuleName.AI],
      }
    ),
    valuePropDescription: tct(
      'See what your [dataTypePlural] are doing in production by monitoring:',
      {
        dataTypePlural: MODULE_DATA_TYPES_PLURAL[ModuleName.AI],
      }
    ),
    valuePropPoints: [
      t('Token cost and usage per-provider and per-pipeline.'),
      tct('The inputs and outputs of [dataType] calls.', {
        dataType: MODULE_DATA_TYPES[ModuleName.AI],
      }),
      tct('Performance and timing information about [dataTypePlural] in production.', {
        dataTypePlural: MODULE_DATA_TYPES_PLURAL[ModuleName.AI],
      }),
    ],
    imageSrc: llmPreviewImg,
  },
  // Mobile UI is not released yet
  'mobile-ui': {
    heading: t('TODO'),
    description: t('TODO'),
    valuePropDescription: t('Mobile UI load insights include:'),
    valuePropPoints: [],
    imageSrc: screenLoadsPreviewImg,
  },
  cache: {
    heading: t('Bringing you one less hard problem in computer science'),
    description: t(
      'We’ll tell you if the parts of your application that interact with caches are hitting cache as often as intended, and whether caching is providing the performance improvements expected.'
    ),
    valuePropDescription: tct('[dataType] insights include:', {
      dataType: MODULE_DATA_TYPES[ModuleName.CACHE],
    }),
    valuePropPoints: [
      t('Throughput of your cached endpoints.'),
      tct('Average [dataType] hit and miss duration.', {
        dataType: MODULE_DATA_TYPES[ModuleName.CACHE].toLocaleLowerCase(),
      }),
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
    heading: tct(
      'Fix the slow [dataTypePlural] you honestly intended to get back to later',
      {dataTypePlural: MODULE_DATA_TYPES_PLURAL[ModuleName.DB].toLocaleLowerCase()}
    ),
    description: tct(
      'Investigate the performance of database [dataTypePlural] and get the information necessary to improve them.',
      {dataTypePlural: MODULE_DATA_TYPES_PLURAL[ModuleName.DB].toLocaleLowerCase()}
    ),
    valuePropDescription: tct('[dataType] insights give you visibility into:', {
      dataType: MODULE_DATA_TYPES[ModuleName.DB],
    }),
    valuePropPoints: [
      tct('Slow [dataTypePlural].', {
        dataTypePlural: MODULE_DATA_TYPES_PLURAL[ModuleName.DB].toLocaleLowerCase(),
      }),
      tct('High volume [dataTypePlural].', {
        dataTypePlural: MODULE_DATA_TYPES_PLURAL[ModuleName.DB].toLocaleLowerCase(),
      }),
      t('Outlier database spans.'),
    ],
    imageSrc: queriesPreviewImg,
  },
  http: {
    heading: t(
      'Are your API dependencies working as well as their landing page promised? '
    ),
    description: t(
      'See the outbound HTTP requests being made to internal and external APIs, allowing you to understand trends in status codes, latency, and throughput.'
    ),
    valuePropDescription: tct('[dataType] insights give you visibility into:', {
      dataType: MODULE_DATA_TYPES[ModuleName.HTTP],
    }),
    valuePropPoints: [
      t('Anomalies in status codes by domain.'),
      t('Request throughput by domain.'),
      t('Average duration of requests.'),
    ],
    imageSrc: requestPreviewImg,
  },
  resource: {
    heading: t('Is your favourite animated gif worth the time it takes to load?'),
    description: tct(
      'Find large and slow-to-load [dataTypePlurl] used by your application and understand their impact on page performance.',
      {dataTypePlurl: MODULE_DATA_TYPES_PLURAL[ModuleName.RESOURCE].toLocaleLowerCase()}
    ),
    valuePropDescription: tct('[dataType] insights give you visibility into:', {
      dataType: MODULE_DATA_TYPES[ModuleName.RESOURCE],
    }),
    valuePropPoints: [
      tct('[dataType] performance broken down by category and domain.', {
        dataType: MODULE_DATA_TYPES[ModuleName.RESOURCE],
      }),
      tct(
        'Which routes are loading [dataTypePlural], and whether they’re blocking rendering.',
        {
          dataTypePlural:
            MODULE_DATA_TYPES_PLURAL[ModuleName.RESOURCE].toLocaleLowerCase(),
        }
      ),
      tct('[dataType] size and whether it’s growing over time.', {
        dataType: MODULE_DATA_TYPES[ModuleName.RESOURCE],
      }),
    ],
    imageSrc: assetsPreviewImg,
  },
  vital: {
    heading: t('Finally answer, is this page slow for everyone or just me?'),
    description: t(
      'Get industry standard metrics telling you the quality of user experience on a web page and see what needs improving.'
    ),
    valuePropDescription: tct('[dataType] insights give you visibility into:', {
      dataType: MODULE_DATA_TYPES[ModuleName.VITAL],
    }),
    valuePropPoints: [
      t('Performance scores broken down by route.'),
      t('Performance metrics for operations that affect screen load performance.'),
      t('Drill down to real user sessions.'),
    ],
    imageSrc: webVitalsPreviewImg,
  },
  queue: {
    heading: t('Ensure your background jobs aren’t being sent to /dev/null'),
    description: tct(
      'Understand the health and performance impact that [dataTypePlural] have on your application and diagnose errors tied to jobs.',
      {
        dataTypePlural: MODULE_DATA_TYPES_PLURAL[ModuleName.QUEUE].toLocaleLowerCase(),
      }
    ),
    valuePropDescription: tct('[dataType] insights give you visibility into:', {
      dataType: MODULE_DATA_TYPES[ModuleName.QUEUE],
    }),
    valuePropPoints: [
      t('Metrics for how long jobs spend processing and waiting in queue.'),
      t('Job error rates and retry counts.'),
      t('Published vs., processed job volume.'),
    ],
    imageSrc: queuesPreviewImg,
  },
  screen_load: {
    heading: t(`Don’t lose your customer’s attention before your app loads`),
    description: tct(
      'View the most active [dataTypePlural] in your mobile application and monitor your releases for screen load performance.',
      {
        dataTypePlural:
          MODULE_DATA_TYPES_PLURAL[ModuleName.SCREEN_LOAD].toLocaleLowerCase(),
      }
    ),
    valuePropDescription: tct('[dataType] insights include:', {
      dataType: MODULE_DATA_TYPES[ModuleName.SCREEN_LOAD],
    }),
    valuePropPoints: [
      t('Compare metrics across releases, root causing performance degradations.'),
      t('See performance by device class.'),
      t('Drill down to real user sessions.'),
    ],
    imageSrc: screenLoadsPreviewImg,
  },
};
