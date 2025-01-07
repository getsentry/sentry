import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import startCase from 'lodash/startCase';
import {PlatformIcon} from 'platformicons';

import appStartPreviewImg from 'sentry-images/insights/module-upsells/insights-app-starts-module-charts.svg';
import assetsPreviewImg from 'sentry-images/insights/module-upsells/insights-assets-module-charts.svg';
import cachesPreviewImg from 'sentry-images/insights/module-upsells/insights-caches-module-charts.svg';
import llmPreviewImg from 'sentry-images/insights/module-upsells/insights-llm-module-charts.svg';
import queriesPreviewImg from 'sentry-images/insights/module-upsells/insights-queries-module-charts.svg';
import queuesPreviewImg from 'sentry-images/insights/module-upsells/insights-queues-module-charts.svg';
import requestPreviewImg from 'sentry-images/insights/module-upsells/insights-requests-module-charts.svg';
import screenLoadsPreviewImg from 'sentry-images/insights/module-upsells/insights-screen-loads-module-charts.svg';
import screenRenderingPreviewImg from 'sentry-images/insights/module-upsells/insights-screen-rendering-module-charts.svg';
import webVitalsPreviewImg from 'sentry-images/insights/module-upsells/insights-web-vitals-module-charts.svg';
import emptyStateImg from 'sentry-images/spot/performance-waiting-for-span.svg';

import {LinkButton} from 'sentry/components/button';
import Panel from 'sentry/components/panels/panel';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PlatformKey} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import type {TitleableModuleNames} from 'sentry/views/insights/common/components/modulePageProviders';
import {useHasFirstSpan} from 'sentry/views/insights/common/queries/useHasFirstSpan';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {
  MODULE_DATA_TYPES,
  MODULE_DATA_TYPES_PLURAL,
  MODULE_PRODUCT_DOC_LINKS,
  MODULE_TITLES,
} from 'sentry/views/insights/settings';
import {ModuleName} from 'sentry/views/insights/types';
import PerformanceOnboarding from 'sentry/views/performance/onboarding';

export function ModulesOnboarding({
  children,
  moduleName,
}: {
  children: React.ReactNode;
  moduleName: ModuleName;
}) {
  const organization = useOrganization();
  const onboardingProject = useOnboardingProject();
  const {reloadProjects} = useProjects();
  const hasData = useHasFirstSpan(moduleName);

  // Refetch the project metadata if the selected project does not have insights data, because
  // we may have received insight data (and subsequently updated `Project.hasInsightxx`)
  // after the initial project fetch.
  useEffect(() => {
    if (!hasData) {
      reloadProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData]);

  if (onboardingProject) {
    return (
      <ModuleLayout.Full>
        <PerformanceOnboarding organization={organization} project={onboardingProject} />
      </ModuleLayout.Full>
    );
  }

  if (!hasData) {
    return (
      <ModuleLayout.Full>
        <ModulesOnboardingPanel moduleName={moduleName} />
      </ModuleLayout.Full>
    );
  }

  return children;
}

function ModulesOnboardingPanel({moduleName}: {moduleName: ModuleName}) {
  const emptyStateContent = EMPTY_STATE_CONTENT[moduleName];
  return (
    <Panel>
      <Container>
        <SplitMainContent>
          <ModuleInfo>
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
          </ModuleInfo>
          <Sidebar>
            <PerfImage src={emptyStateImg} />
          </Sidebar>
        </SplitMainContent>
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
  const [hoveredIcon, setHoveredIcon] = useState<PlatformKey | null>(null);

  return (
    <ModulePreviewContainer>
      <ModulePreviewImage src={emptyStateContent.imageSrc} />
      {emptyStateContent.supportedSdks && (
        <SupportedSdkContainer>
          <div>{t('Supported Today: ')}</div>
          <SupportedSdkList>
            {emptyStateContent.supportedSdks.map((sdk: PlatformKey) => (
              <Tooltip title={startCase(sdk)} key={sdk} position="top">
                <SupportedSdkIconContainer
                  onMouseOver={() => setHoveredIcon(sdk)}
                  onMouseOut={() => setHoveredIcon(null)}
                >
                  <PlatformIcon
                    platform={sdk}
                    size={hoveredIcon === sdk ? '30px' : '25px'}
                  />
                </SupportedSdkIconContainer>
              </Tooltip>
            ))}
          </SupportedSdkList>
        </SupportedSdkContainer>
      )}
    </ModulePreviewContainer>
  );
}

const Sidebar = styled('div')`
  position: relative;
  flex: 3;
`;

const PerfImage = styled('img')`
  max-width: 100%;
  min-width: 200px;
`;

const Container = styled('div')`
  position: relative;
  overflow: hidden;
  min-height: 160px;
  padding: ${space(4)};
`;

const SplitMainContent = styled('div')`
  display: flex;
  align-items: stretch;
  flex-wrap: wrap-reverse;
  gap: ${space(4)};
`;

const Header = styled('h3')`
  margin-bottom: ${space(1)};
`;

const SplitContainer = styled(Panel)`
  display: flex;
  justify-content: center;
  overflow: hidden;
`;

const ModuleInfo = styled('div')`
  flex: 5;
  width: 100%;
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
  flex-wrap: wrap;
  gap: ${space(0.5)};
  justify-content: center;
`;

const SupportedSdkIconContainer = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: ${p => p.theme.gray100};
  width: 42px;
  height: 42px;
  border-radius: 3px;
  &:hover {
    box-shadow: 0 0 0 1px ${p => p.theme.gray200};
  }
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
  supportedSdks?: PlatformKey[];
};

const EMPTY_STATE_CONTENT: Record<TitleableModuleNames, EmptyStateContent> = {
  app_start: {
    heading: t(`Don't lose your user's attention before your app loads`),
    description: tct(
      'Monitor cold and warm [dataTypePlural] and track down the operations and releases contributing to regressions.',
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
    supportedSdks: ['android', 'flutter', 'apple-ios', 'react-native'],
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
    supportedSdks: ['python'],
  },
  // Mobile UI is not released yet
  'mobile-ui': {
    heading: t('TODO'),
    description: t('TODO'),
    valuePropDescription: t('Mobile UI load insights include:'),
    valuePropPoints: [],
    imageSrc: screenLoadsPreviewImg,
  },
  // Mobile Screens is not released yet
  'mobile-screens': {
    heading: t('Mobile Screens'),
    description: t('Explore mobile app metrics.'),
    valuePropDescription: '',
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
    supportedSdks: ['python', 'javascript', 'php', 'java', 'ruby', 'dotnet'],
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
      t('One off slow queries, vs. trends'),
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
    heading: t('Is your favorite animated gif worth the time it takes to load?'),
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
      tct('Whether [dataTypePlural] are blocking page rendering.', {
        dataTypePlural: MODULE_DATA_TYPES_PLURAL[ModuleName.RESOURCE].toLocaleLowerCase(),
      }),
      tct('[dataType] size and whether it’s growing over time.', {
        dataType: MODULE_DATA_TYPES[ModuleName.RESOURCE],
      }),
    ],
    imageSrc: assetsPreviewImg,
    // TODO - this is a lot of manual work, and its duplicated between here and our docs, it would great if there's a single source of truth
    supportedSdks: [
      'javascript',
      'javascript-angular',
      'javascript-astro',
      'javascript-ember',
      'javascript-gatsby',
      'javascript-nextjs',
      'javascript-react',
      'javascript-remix',
      'javascript-solid',
      'javascript-svelte',
      'javascript-sveltekit',
      'javascript-vue',
    ],
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
      t('Performance scores broken down by page.'),
      t('Performance metrics for individual operations that affect page performance.'),
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
    supportedSdks: ['python', 'javascript', 'php', 'java', 'ruby', 'dotnet'],
  },
  screen_load: {
    heading: t(`Don’t lose your user's attention once your app loads`),
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
    supportedSdks: ['android', 'flutter', 'apple-ios', 'react-native'],
  },
  'screen-rendering': {
    description: t(
      'Screen Rendering identifies slow and frozen interactions, helping you find and fix problems that might cause users to complain, or uninstall.'
    ),
    heading: t('Fast-loading apps can still be janky'),
    imageSrc: screenRenderingPreviewImg,
    valuePropDescription: tct('With [moduleTitle]:', {
      moduleTitle: MODULE_TITLES[ModuleName.SCREEN_RENDERING],
    }),
    valuePropPoints: [
      tct('Find and debug slow rendering interactions.', {
        dataType: MODULE_DATA_TYPES[ModuleName.SCREEN_RENDERING].toLowerCase(),
      }),
      t('Compare render performance between releases.'),
      tct('Correlate [dataType] performance with real-user metrics.', {
        dataType: MODULE_DATA_TYPES[ModuleName.SCREEN_RENDERING].toLowerCase(),
      }),
    ],
    supportedSdks: ['android', 'flutter', 'apple-ios', 'react-native'],
  },
  // XXX(epurkhiser): Crons does not use the insights onboarding component.
  crons: {
    description: null,
    heading: null,
    imageSrc: null,
    valuePropDescription: null,
    valuePropPoints: [],
  },
  // XXX(epurkhiser): Uptime does not use the insights onboarding component.
  uptime: {
    description: null,
    heading: null,
    imageSrc: null,
    valuePropDescription: null,
    valuePropPoints: [],
  },
};
