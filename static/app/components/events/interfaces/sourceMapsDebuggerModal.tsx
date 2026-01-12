import type {PropsWithChildren, ReactNode} from 'react';
import {Fragment, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import BadStackTraceExample from 'sentry-images/issue_details/bad-stack-trace-example.png';
import GoodStackTraceExample from 'sentry-images/issue_details/good-stack-trace-example.png';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {ContentSliderDiff} from 'sentry/components/contentSliderDiff';
import {Alert} from 'sentry/components/core/alert';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {CodeBlock} from 'sentry/components/core/code';
import {Flex, Stack} from 'sentry/components/core/layout';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {TabList, TabPanels, Tabs} from 'sentry/components/core/tabs';
import {sourceMapSdkDocsMap} from 'sentry/components/events/interfaces/crashContent/exception/utils';
import {FeedbackModal} from 'sentry/components/featureFeedback/feedbackModal';
import ProgressRing from 'sentry/components/progressRing';
import {
  IconCheckmark,
  IconCircle,
  IconMegaphone,
  IconOpen,
  IconQuestion,
  IconRefresh,
  IconWarning,
} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey, Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {SourceMapWizardBlueThunderAnalyticsParams} from 'sentry/utils/analytics/stackTraceAnalyticsEvents';
import {getSourceMapsWizardSnippet} from 'sentry/utils/getSourceMapsWizardSnippet';
import useProjects from 'sentry/utils/useProjects';

const SOURCE_MAP_SCRAPING_REASON_MAP = {
  not_found: {
    shortName: t('Not Found'),
    explanation: t('The source map could not be found at its defined location.'),
  },
  disabled: {
    shortName: t('Disabled'),
    explanation: t('JavaScript source fetching is disabled in your project settings.'),
  },
  invalid_host: {
    shortName: t('Invalid Host'),
    explanation: t(
      'The source map location was not in the list of allowed domains in your project settings, or the URL was malformed.'
    ),
  },
  permission_denied: {
    shortName: t('Permission Denied'),
    explanation: t(
      'Permission to access the source map was denied by the server hosting the source map. This means that the server hosting the source map returned a 401 Unauthorized or a 403 Forbidden response code.'
    ),
  },
  timeout: {
    shortName: t('Timeout'),
    explanation: t('The request to download the source map timed out.'),
  },
  download_error: {
    shortName: t('Download Error'),
    explanation: t('There was an error while downloading the source map.'),
  },
  other: {
    shortName: t('Unknown'),
    explanation: t('Fetching the source map failed for an unknown reason.'),
  },
} as const;

const SOURCE_FILE_SCRAPING_REASON_MAP = {
  not_found: {
    shortName: t('Not Found'),
    explanation: t('The source file could not be found at its defined location.'),
  },
  disabled: {
    shortName: t('Disabled'),
    explanation: t('JavaScript source fetching is disabled in your project settings.'),
  },
  invalid_host: {
    shortName: t('Invalid Host'),
    explanation: t(
      'The source file location was not in the list of allowed domains in your project settings, or the URL was malformed.'
    ),
  },
  permission_denied: {
    shortName: t('Permission Denied'),
    explanation: t(
      'Permission to access the source file was denied by the server hosting it. This means that the server hosting the source file returned a 401 Unauthorized or a 403 Forbidden response code.'
    ),
  },
  timeout: {
    shortName: t('Timeout'),
    explanation: t('The request to download the source file timed out.'),
  },
  download_error: {
    shortName: t('Download Error'),
    explanation: t('There was an error while downloading the source file.'),
  },
  other: {
    shortName: t('Unknown'),
    explanation: t('Fetching the source file failed for an unknown reason.'),
  },
} as const;

export interface FrameSourceMapDebuggerData {
  debugIdProgress: number;
  debugIdProgressPercent: number;
  dist: string | null;
  eventHasDebugIds: boolean;
  frameIsResolved: boolean;
  hasScrapingData: boolean;
  matchingSourceFileNames: string[];
  matchingSourceMapName: string | null;
  minDebugIdSdkVersion: string | null;
  projectPlatform: PlatformKey | undefined;
  release: string | null;
  releaseHasSomeArtifact: boolean;
  releaseProgress: number;
  releaseProgressPercent: number;
  releaseSourceMapReference: string | null;
  releaseUserAgent: string | null;
  scrapingProgress: number;
  scrapingProgressPercent: number;
  sdkDebugIdSupport: 'full' | 'needs-upgrade' | 'not-supported' | 'unofficial-sdk';
  sdkName: string | null;
  sdkVersion: string | null;
  sourceFileReleaseNameFetchingResult: 'found' | 'wrong-dist' | 'unsuccessful';
  sourceFileScrapingStatus:
    | {status: 'success'; url: string}
    | {reason: string; status: 'failure'; url: string; details?: string}
    | {status: 'not_attempted'; url: string}
    | null;
  sourceMapReleaseNameFetchingResult: 'found' | 'wrong-dist' | 'unsuccessful';
  sourceMapScrapingStatus:
    | {status: 'success'; url: string}
    | {reason: string; status: 'failure'; url: string; details?: string}
    | {status: 'not_attempted'; url: string}
    | null;
  stackFrameDebugId: string | null;
  stackFramePath: string | null;
  uploadedSomeArtifactWithDebugId: boolean;
  uploadedSourceFileWithCorrectDebugId: boolean;
  uploadedSourceMapWithCorrectDebugId: boolean;
}

export interface SourceMapsDebuggerModalProps extends ModalRenderProps {
  analyticsParams: SourceMapWizardBlueThunderAnalyticsParams & {
    organization: Organization | null;
  };
  projectId: string;
  sourceResolutionResults: FrameSourceMapDebuggerData;
  organization?: Organization;
}

export const projectPlatformToDocsMap: Record<string, string> = {
  'node-azurefunctions': 'azure-functions',
  'node-cloudflare-pages': 'cloudflare',
  'node-cloudflare-workers': 'cloudflare',
  'node-connect': 'connect',
  'node-express': 'express',
  'node-fastify': 'fastify',
  'node-gcpfunctions': 'gcp-functions',
  'node-hapi': 'hapi',
  'node-hono': 'hono',
  'node-koa': 'koa',
  'node-nestjs': 'nestjs',
  'node-restify': 'restify',
  'node-awslambda': 'aws-lambda',
  'javascript-react': 'react',
  'javascript-angular': 'angular',
  'javascript-ember': 'ember',
  'javascript-gatsby': 'gatsby',
  'javascript-vue': 'vue',
  'javascript-nextjs': 'nextjs',
  'javascript-nuxt': 'nuxt',
  'javascript-remix': 'remix',
  'javascript-solid': 'solid',
  'javascript-solidstart': 'solidstart',
  'javascript-svelte': 'svelte',
  'javascript-sveltekit': 'sveltekit',
  'javascript-astro': 'astro',
  'javascript-tanstackstart-react': 'tanstackstart-react',
};

function isReactNativeSDK({sdkName}: Pick<FrameSourceMapDebuggerData, 'sdkName'>) {
  return sdkName === 'sentry.javascript.react-native';
}

function getPlatform({
  sdkName,
  projectPlatform,
}: Pick<FrameSourceMapDebuggerData, 'sdkName' | 'projectPlatform'>) {
  const platformBySdkName = defined(sdkName) ? sourceMapSdkDocsMap[sdkName] : undefined;
  const platformByProjectName = defined(projectPlatform)
    ? projectPlatformToDocsMap[projectPlatform]
    : undefined;
  return (
    (platformBySdkName === 'node' ? platformByProjectName : platformBySdkName) ??
    'javascript'
  );
}

export function getSourceMapsDocLinks(platform: string) {
  if (platform === 'react-native') {
    return {
      sourcemaps: `https://docs.sentry.io/platforms/react-native/sourcemaps/`,
      legacyUploadingMethods: `https://docs.sentry.io/platforms/react-native/sourcemaps/troubleshooting/legacy-uploading-methods/`,
      sentryCli: `https://docs.sentry.io/platforms/react-native/sourcemaps/uploading/`,
      bundlerPluginRepoLink: `https://docs.sentry.io/platforms/react-native/manual-setup/metro/`,
      debugIds: `https://docs.sentry.io/platforms/react-native/sourcemaps/debug-ids/`,
    };
  }

  const basePlatformUrl =
    platform === 'javascript'
      ? 'https://docs.sentry.io/platforms/javascript'
      : `https://docs.sentry.io/platforms/javascript/guides/${platform}`;

  return {
    sourcemaps: `${basePlatformUrl}/sourcemaps/`,
    // Although we have a few specific sourcemap pages (see: https://github.com/getsentry/sentry-docs/tree/master/platform-includes/sourcemaps/primer),
    // they don't include the Sentry bundler section. All the others just render content for JavaScript.
    // Therefore, we have a static link here.
    sentryBundleSupport: `https://docs.sentry.io/platforms/javascript/sourcemaps/#sentry-bundler-support`,
    // cordova and capacitor are not supported. (see: https://github.com/getsentry/sentry-docs/blob/c64fb081cad715dc9dd7639265e09c372c3a65e3/docs/platforms/javascript/common/sourcemaps/troubleshooting_js/artifact-bundles.mdx?plain=1#L4-L6)
    debugIds: ['cordova', 'capacitor'].includes(platform)
      ? undefined
      : `${basePlatformUrl}/sourcemaps/troubleshooting_js/debug-ids/`,
    // cordova and capacitor are not supported. (see: https://github.com/getsentry/sentry-docs/blob/c64fb081cad715dc9dd7639265e09c372c3a65e3/docs/platforms/javascript/common/sourcemaps/troubleshooting_js/artifact-bundles.mdx?plain=1#L4-L6)
    legacyUploadingMethods: ['cordova', 'capacitor'].includes(platform)
      ? undefined
      : `${basePlatformUrl}/sourcemaps/troubleshooting_js/legacy-uploading-methods/`,
    rewriteFrames: `${basePlatformUrl}/configuration/integrations/rewriteframes/`,
    // nextjs, remix, solidstart, sveltekit, astro and nuxt are not supported. (see: https://github.com/getsentry/sentry-docs/blob/c341c7679d84bc0fdb05335ebe150c2ca6469e1d/docs/platforms/javascript/common/sourcemaps/uploading/index.mdx?plain=1#L5-L11)
    sentryCli: ['nextjs', 'remix', 'solidstart', 'sveltekit', 'astro', 'nuxt'].includes(
      platform
    )
      ? undefined
      : `${basePlatformUrl}/sourcemaps/uploading/cli/`,
    // a few platforms are not supported. (see: https://github.com/getsentry/sentry-docs/blob/db4ea29ed330b69bf95b526c7dd988a1dda5e542/docs/platforms/javascript/common/sourcemaps/uploading/hosting-publicly.mdx?plain=1#L5-L22)
    hostingPublicly: [
      'node',
      'aws-lambda',
      'azure-functions',
      'connect',
      'express',
      'fastify',
      'gcp-functions',
      'hapi',
      'hono',
      'koa',
      'nestjs',
      'nextjs',
      'astro',
      'nuxt',
      'remix',
      'solidstart',
      'sveltekit',
    ].includes(platform)
      ? undefined
      : `${basePlatformUrl}/sourcemaps/uploading/hosting-publicly/`,
    bundlerPluginRepoLink: `https://github.com/getsentry/sentry-javascript-bundler-plugins`,
  };
}

function SentryWizardCallout({
  analyticsParams,
  organization,
  project,
}: Pick<SourceMapsDebuggerModalProps, 'analyticsParams' | 'organization'> & {
  project?: Project;
}) {
  const isSelfHosted = ConfigStore.get('isSelfHosted');
  return (
    <Fragment>
      <WizardInstructionParagraph>
        {t(
          "Have you already run the Sentry Wizard with `sourcemaps` in your project's terminal? It's the easiest way to get source maps set up:"
        )}
      </WizardInstructionParagraph>
      <InstructionCodeSnippet
        language="bash"
        dark
        onCopy={() => {
          trackAnalytics(
            'source_map_debug_blue_thunder.source_map_wizard_command_copied',
            analyticsParams
          );
        }}
        onSelectAndCopy={() => {
          trackAnalytics(
            'source_map_debug_blue_thunder.source_map_wizard_command_copied',
            analyticsParams
          );
        }}
      >
        {getSourceMapsWizardSnippet({
          isSelfHosted,
          organization,
          project,
        })}
      </InstructionCodeSnippet>
    </Fragment>
  );
}

const metaFrameworksWithSentryWizardInOnboarding = [
  'nextjs',
  'nuxt',
  'remix',
  'sveltekit',
];

function MetaFrameworkConfigInfo({
  framework,
  orgSlug = 'example-org',
  projectSlug = 'example-project',
}: {
  framework: string;
  orgSlug?: string;
  projectSlug?: string;
}) {
  if (framework === 'nextjs') {
    return (
      <Fragment>
        <p>
          {tct(
            'Ensure that source maps are enabled as in the snippet below. For more details [docLink:read the docs].',
            {
              docLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#step-5-add-readable-stack-traces-with-source-maps-optional" />
              ),
            }
          )}
        </p>
        <InstructionCodeSnippet
          language="javascript"
          dark
          filename="next.config.(js|mjs)"
        >
          {`export default withSentryConfig(nextConfig, {
  // If you use environment variables,
  // you don't need to specify these options
  org: "${orgSlug}",
  project: "${projectSlug}",

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,
  // ... rest of your sentry config
});`}
        </InstructionCodeSnippet>
      </Fragment>
    );
  }

  if (framework === 'nuxt') {
    return (
      <Fragment>
        <p>
          {tct(
            'Ensure that source maps are enabled as in the snippet below. For more details [docLink:read the docs].',
            {
              docLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nuxt/manual-setup/#source-maps-upload" />
              ),
            }
          )}
        </p>
        <InstructionCodeSnippet language="javascript" dark filename="nuxt.config.ts">
          {`export default defineNuxtConfig({
  modules: ["@sentry/nuxt/module"],
  sentry: {
    sourceMapsUploadOptions: {
      // If you use environment variables,
      // you don't need to specify these options
      org: "${orgSlug}",
      project: "${projectSlug}",
      // ... rest of your sourceMapsUploadOptions
    }
    // ... rest of your sentry config
  },
  // Enable it explicitly for the client-side
  // The 'hidden' option functions the same as true
  sourcemap: { client: "hidden" }
  // ... rest of your Nuxt config
});
`}
        </InstructionCodeSnippet>
      </Fragment>
    );
  }

  if (framework === 'remix') {
    return (
      <Fragment>
        <p>
          {tct(
            'If you are using the [vitePluginLink:Sentry Vite Plugin] (recommended), ensure that source maps are enabled as in the snippet below. For more details [docLink:read the docs].',
            {
              vitePluginLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/vite/" />
              ),
              docLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/remix/sourcemaps/#using-vite-plugin-recommended" />
              ),
            }
          )}
        </p>
        <InstructionCodeSnippet language="javascript" dark filename="vite.config.ts">
          {`export default defineConfig({
  plugins: [
    remix({
      // ... your Remix plugin options
    }),
    sentryVitePlugin({
      // If you use environment variables,
      // you don't need to specify these options
      org: "${orgSlug}",
      project: "${projectSlug}",
      // ... rest of your sentryVitePlugin
    }),
    // ... rest of your plugins
  ],
  build: {
    sourcemap: true,
    // ... rest of your Vite build options
  },
  // ... rest of your Vite config
});`}
        </InstructionCodeSnippet>
      </Fragment>
    );
  }

  // Sveltekit
  return (
    <Fragment>
      <p>
        {tct(
          'Make sure source maps is not disabled as in the snippet below. For more details [docLink:read the docs].',
          {
            docLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/sveltekit/manual-setup/#source-maps-upload" />
            ),
          }
        )}
      </p>
      <InstructionCodeSnippet language="javascript" dark filename="vite.config.(js|ts)">
        {`export default {
  plugins: [
    sentrySvelteKit({
      // If you use environment variables,
      // you don't need to specify these options
      org: "${orgSlug}",
      project: "${projectSlug}",
      // Set this to true, or omit it entirely
      autoUploadSourceMaps: true,
      // ... rest of your sentrySvelteKit
    }),
    sveltekit(),
  ],
  // ... rest of your Vite config
};`}
      </InstructionCodeSnippet>
    </Fragment>
  );
}
type SourceMapsDocLinks = ReturnType<typeof getSourceMapsDocLinks>;

function DebuggerSection({
  title,
  children,
}: {
  children: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <DebuggerSectionContainer>
      <h5>{title}</h5>
      {children}
    </DebuggerSectionContainer>
  );
}

export function SourceMapsDebuggerModal({
  Body,
  Header,
  Footer,
  sourceResolutionResults,
  analyticsParams,
  organization,
  projectId,
}: SourceMapsDebuggerModalProps) {
  const theme = useTheme();

  const {projects} = useProjects();
  const project = projects.find(p => p.id === projectId);

  const platform = getPlatform(sourceResolutionResults);
  const sourceMapsDocLinks = getSourceMapsDocLinks(platform);

  const hideDebugIdsTab = sourceResolutionResults.sdkDebugIdSupport === 'not-supported';
  const hideReleasesTab = sourceResolutionResults.sdkDebugIdSupport === 'full';
  const hideHostingPubliclyTab =
    !sourceResolutionResults.hasScrapingData ||
    isReactNativeSDK({sdkName: sourceResolutionResults.sdkName});

  const tabOptions = useMemo(
    () => [
      {
        key: 'debug-ids' as const,
        hidden: hideDebugIdsTab,
        progress: sourceResolutionResults.debugIdProgressPercent,
      },
      {
        key: 'release' as const,
        hidden: hideReleasesTab,
        progress: sourceResolutionResults.releaseProgressPercent,
      },
      {
        key: 'fetching' as const,
        hidden: hideHostingPubliclyTab,
        progress: sourceResolutionResults.scrapingProgressPercent,
      },
    ],
    [
      hideDebugIdsTab,
      hideReleasesTab,
      hideHostingPubliclyTab,
      sourceResolutionResults.debugIdProgressPercent,
      sourceResolutionResults.releaseProgressPercent,
      sourceResolutionResults.scrapingProgressPercent,
    ]
  );

  const visibleTabs = tabOptions.filter(tab => !tab.hidden);
  const hideAllTabs = visibleTabs.length === 1;

  const [activeTab, setActiveTab] = useState<'debug-ids' | 'release' | 'fetching'>(() => {
    if (hideAllTabs) {
      const onlyVisible = visibleTabs[0];
      if (onlyVisible) {
        return onlyVisible.key;
      }
    }

    // Get the tab with the most progress
    return visibleTabs.reduce((prev, curr) =>
      curr.progress > prev.progress ? curr : prev
    ).key;
  });

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Make Your Stack Traces Readable')}</h4>
      </Header>
      <Body>
        <p>
          {t(
            "It looks like the original source code for this stack frame couldn't be determined when this error was captured. To get the original code for this stack frame, Sentry needs source maps to be uploaded."
          )}
        </p>
        <DebuggerSection title={t('Why Configure Source Maps?')}>
          <p>
            {t(
              "With properly configured source maps, you'll see the code that was written instead of minified, obfuscated code. This makes debugging significantly easier and faster."
            )}
          </p>
          <p>
            {t(
              'An image says more than a thousand words. Below you can see a comparison of how a bad and a good stack trace look like:'
            )}
          </p>
          <div>
            <ContentSliderDiff.Header>
              <Flex align="center">{t('Without Source Maps')}</Flex>
              <Flex align="center">{t('With Source Maps')}</Flex>
            </ContentSliderDiff.Header>
            <ContentSliderDiff.Body
              before={
                <img src={BadStackTraceExample} alt={t('Bad Stack Trace Example')} />
              }
              after={
                <img src={GoodStackTraceExample} alt={t('Good Stack Trace Example')} />
              }
              minHeight="300px"
            />
          </div>
        </DebuggerSection>
        <DebuggerSection title={t('Troubleshooting Your Source Maps')}>
          <h6>{t('Latest Sentry Tools')}</h6>
          <p>
            {t(
              'Keep your Sentry tools up to date to avoid issues with source map uploads and ensure full compatibility.'
            )}
          </p>
          <h6>{t('Source Maps Setup')}</h6>
          {isReactNativeSDK({
            sdkName: sourceResolutionResults.sdkName,
          }) ? (
            <WizardInstructionParagraph>
              {tct(
                "For React Native projects, source maps should be generated and uploaded automatically during the build process. If they're not showing up, chances are something's off in your setup. [link:Our docs] can help you double-check.",
                {
                  link: (
                    <ExternalLinkWithIcon href="https://docs.sentry.io/platforms/react-native/sourcemaps/" />
                  ),
                }
              )}
            </WizardInstructionParagraph>
          ) : metaFrameworksWithSentryWizardInOnboarding.includes(platform) ? (
            <MetaFrameworkConfigInfo
              framework={platform}
              orgSlug={organization?.slug}
              projectSlug={project?.slug}
            />
          ) : (
            <SentryWizardCallout
              analyticsParams={analyticsParams}
              organization={organization}
              project={project}
            />
          )}
          <h6>{t('Troubleshooting Checklist')}</h6>
          {!hideAllTabs && (
            <p>
              {t(
                "Now, let's go through a quick checklist to help you troubleshoot your source maps further. There are a few ways to configure them:"
              )}
            </p>
          )}
          <Tabs<'debug-ids' | 'release' | 'fetching'>
            value={activeTab}
            onChange={setActiveTab}
          >
            <TabList>
              <TabList.Item
                key="debug-ids"
                textValue={`${t('Debug IDs')} (${
                  sourceResolutionResults.debugIdProgress
                }/4)`}
                hidden={hideDebugIdsTab || hideAllTabs}
              >
                <StyledProgressRing
                  progressColor={
                    activeTab === 'debug-ids'
                      ? theme.colors.blue400
                      : theme.colors.gray400
                  }
                  backgroundColor={theme.colors.gray200}
                  value={sourceResolutionResults.debugIdProgressPercent * 100}
                  size={16}
                  barWidth={4}
                />
                {`${t('Debug IDs')}${
                  sourceResolutionResults.sdkDebugIdSupport === 'not-supported'
                    ? ''
                    : ' ' + t('(recommended)')
                }`}
              </TabList.Item>
              <TabList.Item
                key="release"
                textValue={`${t('Releases')} (${
                  sourceResolutionResults.releaseProgress
                }/4)`}
                hidden={hideReleasesTab || hideAllTabs}
              >
                <StyledProgressRing
                  progressColor={
                    activeTab === 'release' ? theme.colors.blue400 : theme.colors.gray400
                  }
                  backgroundColor={theme.colors.gray200}
                  value={sourceResolutionResults.releaseProgressPercent * 100}
                  size={16}
                  barWidth={4}
                />
                {t('Releases')}
              </TabList.Item>
              <TabList.Item
                key="fetching"
                textValue={`${t('Hosting Publicly')} (${
                  sourceResolutionResults.scrapingProgress
                }/4)`}
                hidden={hideHostingPubliclyTab || hideAllTabs}
              >
                <StyledProgressRing
                  progressColor={
                    activeTab === 'fetching' ? theme.colors.blue400 : theme.colors.gray400
                  }
                  backgroundColor={theme.colors.gray200}
                  value={sourceResolutionResults.scrapingProgressPercent * 100}
                  size={16}
                  barWidth={4}
                />
                {t('Hosting Publicly')}
              </TabList.Item>
            </TabList>
            <StyledTabPanels hideAllTabs={hideAllTabs}>
              <TabPanels.Item key="debug-ids">
                {hideAllTabs ? (
                  <p>
                    {isReactNativeSDK({sdkName: sourceResolutionResults.sdkName})
                      ? tct(
                          "After confirming your setup is correct, the next step is verifying your Debug IDs, which link your source files to the source maps. Let's make sure they're set up properly by running through this quick checklist:",
                          {
                            link: sourceMapsDocLinks.debugIds ? (
                              <ExternalLink href={sourceMapsDocLinks.debugIds} />
                            ) : undefined,
                          }
                        )
                      : tct(
                          "We rely on [link:Debug IDs] to link your source files to the maps, so let's make sure they're set up correctly:",
                          {
                            link: sourceMapsDocLinks.debugIds ? (
                              <ExternalLink href={sourceMapsDocLinks.debugIds} />
                            ) : undefined,
                          }
                        )}
                  </p>
                ) : (
                  <p>
                    {tct(
                      '[link:Debug IDs] are a way of matching your source files to source maps. Follow all of the steps below to get a readable stack trace:',
                      {
                        link: defined(sourceMapsDocLinks.debugIds) ? (
                          <ExternalLinkWithIcon href={sourceMapsDocLinks.debugIds} />
                        ) : (
                          <Fragment />
                        ),
                      }
                    )}
                  </p>
                )}
                <CheckList>
                  <InstalledSdkChecklistItem
                    setActiveTab={setActiveTab}
                    sourceResolutionResults={sourceResolutionResults}
                  />
                  <HasDebugIdChecklistItem
                    shouldValidate={
                      sourceResolutionResults.sdkDebugIdSupport === 'full' ||
                      sourceResolutionResults.sdkDebugIdSupport === 'unofficial-sdk' ||
                      sourceResolutionResults.eventHasDebugIds
                    }
                    sourceResolutionResults={sourceResolutionResults}
                  />
                  <UploadedSourceFileWithCorrectDebugIdChecklistItem
                    shouldValidate={sourceResolutionResults.stackFrameDebugId !== null}
                    sourceResolutionResults={sourceResolutionResults}
                    projectSlug={project?.slug}
                  />
                  <UploadedSourceMapWithCorrectDebugIdChecklistItem
                    shouldValidate={
                      sourceResolutionResults.uploadedSourceFileWithCorrectDebugId
                    }
                    sourceResolutionResults={sourceResolutionResults}
                    projectSlug={project?.slug}
                  />
                </CheckList>
                {sourceResolutionResults.debugIdProgressPercent === 1 ? (
                  <ChecklistDoneNote />
                ) : (
                  <VerifyAgainNote />
                )}
              </TabPanels.Item>
              <TabPanels.Item key="release">
                {hideAllTabs ? (
                  <p>
                    {isReactNativeSDK({
                      sdkName: sourceResolutionResults.sdkName,
                    })
                      ? tct(
                          "After confirming your setup is correct, the next step is to check whether your source maps are properly linked to your stack traces. This happens through [link:Releases] and artifact names, so let's make sure those are configured correctly:",
                          {
                            link: (
                              <ExternalLinkWithIcon href="https://docs.sentry.io/product/releases/" />
                            ),
                          }
                        )
                      : t(
                          "Now, let's go through a checklist to troubleshoot why your source maps aren't showing up. Your stack trace is matched to your source code using [link:Releases] and artifact names, so let's ensure that's set up correctly:",
                          {
                            link: (
                              <ExternalLinkWithIcon href="https://docs.sentry.io/product/releases/" />
                            ),
                          }
                        )}
                  </p>
                ) : (
                  <p>
                    {tct(
                      'You can match your stack trace to your source code based on [link:Releases] and artifact names. Follow all of the steps below to get a readable stack trace:',
                      {
                        link: (
                          <ExternalLinkWithIcon href="https://docs.sentry.io/product/releases/" />
                        ),
                      }
                    )}
                  </p>
                )}
                <CheckList>
                  <EventHasReleaseNameChecklistItem
                    sourceResolutionResults={sourceResolutionResults}
                  />
                  <ReleaseHasUploadedArtifactsChecklistItem
                    shouldValidate={sourceResolutionResults.release !== null}
                    sourceResolutionResults={sourceResolutionResults}
                  />
                  <ReleaseSourceFileMatchingChecklistItem
                    shouldValidate={sourceResolutionResults.releaseHasSomeArtifact}
                    sourceResolutionResults={sourceResolutionResults}
                  />
                  <ReleaseSourceMapMatchingChecklistItem
                    shouldValidate={
                      sourceResolutionResults.sourceFileReleaseNameFetchingResult ===
                      'found'
                    }
                    sourceResolutionResults={sourceResolutionResults}
                  />
                </CheckList>
                {sourceResolutionResults.releaseProgressPercent === 1 ? (
                  <ChecklistDoneNote />
                ) : (
                  <VerifyAgainNote />
                )}
              </TabPanels.Item>
              <TabPanels.Item key="fetching">
                <p>
                  {tct(
                    'Sentry will fetch your source files and source maps if you [link:host them publicly].',
                    {
                      link: defined(sourceMapsDocLinks.hostingPublicly) ? (
                        <ExternalLinkWithIcon href={sourceMapsDocLinks.hostingPublicly} />
                      ) : (
                        <Fragment />
                      ),
                    }
                  )}
                </p>
                <CheckList>
                  <ScrapingSourceFileAvailableChecklistItem
                    sourceResolutionResults={sourceResolutionResults}
                  />
                  <ScrapingSourceMapAvailableChecklistItem
                    sourceResolutionResults={sourceResolutionResults}
                  />
                </CheckList>
                {sourceResolutionResults.scrapingProgressPercent === 1 ? (
                  <ChecklistDoneNote />
                ) : (
                  <VerifyAgainNote />
                )}
              </TabPanels.Item>
            </StyledTabPanels>
          </Tabs>
        </DebuggerSection>
      </Body>
      <Footer>
        <Link
          to="#"
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            openModal(modalProps => (
              <FeedbackModal
                featureName="sourcemaps-debugger"
                feedbackTypes={[t('This was helpful'), t('This was not helpful')]}
                useNewUserFeedback
                {...modalProps}
              />
            ));
          }}
        >
          {t('Was this helpful? Give us feedback!')} <IconMegaphone size="xs" />
        </Link>
      </Footer>
    </Fragment>
  );
}

function CheckListItem({children, title, status}: PropsWithChildren<CheckListItemProps>) {
  return (
    <ListItemContainer>
      <Stack align="center">
        {
          {
            none: <IconCircle size="md" variant="muted" />,
            checked: <IconCheckmark size="md" variant="success" />,
            alert: <IconWarning size="md" variant="warning" />,
            question: <IconQuestion size="md" variant="muted" />,
          }[status]
        }
        <Line className="source-map-debugger-modal-checklist-line" />
      </Stack>
      <ListItemContentContainer>
        <Flex align="center" minHeight="20px">
          <ListItemTitle status={status}>{title}</ListItemTitle>
        </Flex>
        {children}
      </ListItemContentContainer>
    </ListItemContainer>
  );
}

function InstalledSdkChecklistItem({
  sourceResolutionResults,
  setActiveTab,
}: {
  setActiveTab: React.Dispatch<
    React.SetStateAction<'release' | 'debug-ids' | 'fetching'>
  >;
  sourceResolutionResults: FrameSourceMapDebuggerData;
}) {
  const successMessage = t('Installed SDK supports Debug IDs');
  const errorMessage = t('Installed SDK does not support Debug IDs');
  const maybeErrorMessage = t("Installed SDK potentially doesn't support Debug IDs");

  if (
    sourceResolutionResults.eventHasDebugIds ||
    sourceResolutionResults.sdkDebugIdSupport === 'full'
  ) {
    return <CheckListItem status="checked" title={successMessage} />;
  }

  if (sourceResolutionResults.sdkDebugIdSupport === 'needs-upgrade') {
    return (
      <CheckListItem status="alert" title={errorMessage}>
        <CheckListInstruction variant="muted">
          <h6>{t('Outdated SDK')}</h6>
          <p>
            {sourceResolutionResults.sdkVersion === null
              ? t(
                  'You are using an outdated version of the Sentry SDK which does not support debug IDs.'
                )
              : tct(
                  'You are using version [currentVersion] of the Sentry SDK which does not support debug IDs.',
                  {
                    currentVersion: (
                      <MonoBlock>{sourceResolutionResults.sdkVersion}</MonoBlock>
                    ),
                  }
                )}{' '}
            {sourceResolutionResults.minDebugIdSdkVersion === null
              ? t('You should upgrade to the latest version.')
              : tct('You should upgrade to version [targetVersion] or higher.', {
                  targetVersion: (
                    <MonoBlock>{sourceResolutionResults.minDebugIdSdkVersion}</MonoBlock>
                  ),
                })}
          </p>
          <p>
            {tct(
              'If upgrading the SDK is not an option for you, you can use the [link:Release] process instead.',
              {
                link: <Link to="" onClick={() => setActiveTab('release')} />,
              }
            )}
          </p>
        </CheckListInstruction>
      </CheckListItem>
    );
  }

  if (sourceResolutionResults.sdkDebugIdSupport === 'not-supported') {
    return (
      <CheckListItem status="alert" title={errorMessage}>
        <CheckListInstruction variant="muted">
          <h6>{t("SDK Doesn't Support Debug IDs")}</h6>
          <p>
            {tct(
              'The SDK you are using does not support debug IDs yet. We recommend using the [link:Release] process instead.',
              {
                link: <Link to="" onClick={() => setActiveTab('release')} />,
              }
            )}
          </p>
        </CheckListInstruction>
      </CheckListItem>
    );
  }

  return (
    <CheckListItem status="question" title={maybeErrorMessage}>
      <CheckListInstruction variant="muted">
        <h6>{t('Unofficial SDK')}</h6>
        <p>
          {tct(
            "You are using an unofficial Sentry SDK. Please check whether this SDK already supports Debug IDs. It's possible that this SDK supports debug IDs but you may be better off using the [link:Release Name] method of uploading source maps.",
            {
              link: <Link to="" onClick={() => setActiveTab('release')} />,
            }
          )}
        </p>
        <p>
          {t(
            'If this SDK depends on an official Sentry SDK, the earliest version that supports Debug IDs is version 7.56.0'
          )}
        </p>
      </CheckListInstruction>
    </CheckListItem>
  );
}

function getToolUsedToUploadSourceMaps({
  releaseUserAgent,
}: Pick<FrameSourceMapDebuggerData, 'releaseUserAgent'>) {
  const tools = [
    'sentry-cli',
    'vite-plugin',
    'webpack-plugin',
    'rollup-plugin',
    'esbuild-plugin',
  ];

  return tools.reduce(
    (acc, tool) => {
      const key = tool.replace(/-([a-z])/g, (_match, name) => name.toUpperCase());
      acc[key] = releaseUserAgent?.includes(tool) ?? false;
      return acc;
    },
    {} as Record<string, boolean>
  );
}

type ToolUsedToUploadSourceMaps = ReturnType<typeof getToolUsedToUploadSourceMaps>;

const pluginConfig: Record<
  keyof Omit<ToolUsedToUploadSourceMaps, 'sentryCli'>,
  {
    configFile: string;
    link: string;
    name: string;
  }
> = {
  vitePlugin: {
    name: 'Vite',
    link: 'https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/vite/',
    configFile: 'vite.config.(js|ts)',
  },
  webpackPlugin: {
    name: 'Webpack',
    link: 'https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/webpack/',
    configFile: 'webpack.config.(js|ts)',
  },
  rollupPlugin: {
    name: 'Rollup',
    link: 'https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/rollup/',
    configFile: 'rollup.config.(js|ts)',
  },
  esbuildPlugin: {
    name: 'Esbuild',
    link: 'https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/esbuild/',
    configFile: 'esbuild.config.(js|ts)',
  },
};

function SentryPluginMessage({
  toolUsedToUploadSourceMaps,
  sourceMapsDocLinks,
}: {
  sourceMapsDocLinks: SourceMapsDocLinks;
  toolUsedToUploadSourceMaps: ToolUsedToUploadSourceMaps;
}) {
  const activePlugin = Object.keys(pluginConfig).find(
    key => toolUsedToUploadSourceMaps[key]
  );

  const plugin = activePlugin ? pluginConfig[activePlugin] : undefined;

  if (plugin) {
    return (
      <p>
        {tct(
          'For your Sentry [pluginNameAndLink] Plugin, check your [configFile] and ensure the plugin is active when building your production app. You cannot do two separate builds—one for uploading to Sentry with the plugin active, and one for deploying without it.',
          {
            pluginNameAndLink: (
              <ExternalLinkWithIcon href={plugin.link}>
                {plugin.name}
              </ExternalLinkWithIcon>
            ),
            configFile: <code>{plugin.configFile}</code>,
          }
        )}
      </p>
    );
  }

  return (
    <p>
      {tct(
        'If you are using a [bundlerPluginRepoLink:Sentry Plugin for your Bundler], the plugin needs to be active when building your production app. You cannot do two separate builds, for example, one for uploading to Sentry with the plugin being active and one for deploying without the plugin.',
        {
          bundlerPluginRepoLink: (
            <ExternalLinkWithIcon href={sourceMapsDocLinks.bundlerPluginRepoLink} />
          ),
        }
      )}
    </p>
  );
}

function SentryCliMessage({
  sourceResolutionResults,
  sourceMapsDocLinks,
  toolUsedToUploadSourceMaps,
}: {
  sourceMapsDocLinks: SourceMapsDocLinks & {
    sentryCli: NonNullable<SourceMapsDocLinks['sentryCli']>;
  };
  sourceResolutionResults: FrameSourceMapDebuggerData;
  toolUsedToUploadSourceMaps: ToolUsedToUploadSourceMaps;
}) {
  if (isReactNativeSDK({sdkName: sourceResolutionResults.sdkName})) {
    return (
      <p>
        {tct(
          'When manually creating source maps, ensure that you upload the exact same files that were bundled into the application package. For details, see the [uploadingSourceMapsLink:Uploading Source Maps documentation]',
          {
            uploadingSourceMapsLink: (
              <ExternalLinkWithIcon href={sourceMapsDocLinks.sentryCli} />
            ),
          }
        )}
      </p>
    );
  }

  if (toolUsedToUploadSourceMaps.sentryCli) {
    return (
      <p>
        {tct(
          'Since you are utilizing [sentryCliLink:Sentry CLI], ensure that you deploy the exact files that the [injectCommand] command has modified.',
          {
            sentryCliLink: <ExternalLinkWithIcon href={sourceMapsDocLinks.sentryCli} />,
            injectCommand: <MonoBlock>sentry-cli sourcemaps inject</MonoBlock>,
          }
        )}
      </p>
    );
  }

  return (
    <p>
      {tct(
        'If you are utilizing [sentryCliLink:Sentry CLI], ensure that you deploy the exact files that the [injectCommand] command has modified.',
        {
          sentryCliLink: <ExternalLinkWithIcon href={sourceMapsDocLinks.sentryCli} />,
          injectCommand: <MonoBlock>sentry-cli sourcemaps inject</MonoBlock>,
        }
      )}
    </p>
  );
}

function HasDebugIdChecklistItem({
  sourceResolutionResults,
  shouldValidate,
}: {
  shouldValidate: boolean;
  sourceResolutionResults: FrameSourceMapDebuggerData;
}) {
  const platform = getPlatform(sourceResolutionResults);
  const sourceMapsDocLinks = getSourceMapsDocLinks(platform);
  const successMessage = t('Stack frame has Debug IDs');
  const errorMessage = t("Stack frame doesn't have Debug IDs");

  if (!shouldValidate) {
    return <CheckListItem status="none" title={successMessage} />;
  }

  if (sourceResolutionResults.stackFrameDebugId !== null) {
    return <CheckListItem status="checked" title={successMessage} />;
  }

  if (sourceResolutionResults.eventHasDebugIds) {
    return (
      <CheckListItem status="alert" title={errorMessage}>
        <CheckListInstruction variant="muted">
          <h6>{t('Source Is Missing Injection')}</h6>
          <p>
            {tct(
              'The event already has debug IDs for some stack frames but not for this one. Please configure the tool you are using to upload source maps to inject debug IDs into [bold:all] of your build artifacts.',
              {bold: <b />}
            )}
          </p>
        </CheckListInstruction>
      </CheckListItem>
    );
  }

  if (sourceResolutionResults.uploadedSomeArtifactWithDebugId) {
    const toolUsedToUploadSourceMaps = getToolUsedToUploadSourceMaps(
      sourceResolutionResults
    );
    return (
      <CheckListItem status="alert" title={errorMessage}>
        <CheckListInstruction variant="muted">
          <h6>Uploaded Files Not Deployed</h6>
          {isReactNativeSDK({sdkName: sourceResolutionResults.sdkName}) ? (
            <Fragment>
              <p>
                {t(
                  "It seems you already uploaded artifacts with Debug IDs, however, this event doesn't contain any Debug IDs yet. Generally this means that your application doesn't include the same files you uploaded to Sentry."
                )}
              </p>
              <p>
                {t(
                  'For Sentry to be able to show your original source code, it is required that you build the application with the exact same files that you uploaded to Sentry.'
                )}
              </p>
              <p>
                {tct(
                  'The [bundlerPluginRepoLink:Sentry Metro Plugin] needs to be active when building your production app. You cannot do two separate builds, for example, one for uploading to Sentry with the plugin being active and one for deploying without the plugin.',
                  {
                    bundlerPluginRepoLink: (
                      <ExternalLinkWithIcon
                        href={sourceMapsDocLinks.bundlerPluginRepoLink}
                      />
                    ),
                  }
                )}
              </p>
            </Fragment>
          ) : (
            <Fragment>
              <p>
                {t(
                  "It seems you already uploaded artifacts with Debug IDs, however, this event doesn't contain any Debug IDs yet. Generally this means that you didn't deploy the same files you injected the Debug IDs into. For Sentry to be able to show your original source code, it is required that you deploy the exact same files that you uploaded to Sentry."
                )}
              </p>
              <SentryPluginMessage
                toolUsedToUploadSourceMaps={toolUsedToUploadSourceMaps}
                sourceMapsDocLinks={sourceMapsDocLinks}
              />
            </Fragment>
          )}
          {defined(sourceMapsDocLinks.sentryCli) && (
            <SentryCliMessage
              sourceMapsDocLinks={{
                ...sourceMapsDocLinks,
                sentryCli: sourceMapsDocLinks.sentryCli,
              }}
              sourceResolutionResults={sourceResolutionResults}
              toolUsedToUploadSourceMaps={toolUsedToUploadSourceMaps}
            />
          )}
        </CheckListInstruction>
      </CheckListItem>
    );
  }

  return (
    <CheckListItem status="alert" title={errorMessage}>
      <CheckListInstruction variant="muted">
        <h6>{t('No Debug ID Tooling Used')}</h6>
        <p>
          {tct(
            "This event doesn't contain any Debug IDs. Read the [link:Sentry Source Maps Documentation] to learn how to inject Debug IDs into your build artifacts and how to upload them to Sentry.",
            {
              link: <ExternalLinkWithIcon href={sourceMapsDocLinks.sourcemaps} />,
            }
          )}
        </p>
      </CheckListInstruction>
    </CheckListItem>
  );
}

function DebugIdMismatchMessage({
  debugId,
  projectSlug,
}: {
  debugId: string | null;
  projectSlug?: string;
}) {
  // At this point debugId is always defined. The types need to be fixed
  if (!debugId) {
    return (
      <Fragment>
        {t(
          "You already uploaded artifacts with Debug IDs but none of the uploaded source files had a Debug ID matching this stack frame's Debug ID"
        )}
      </Fragment>
    );
  }

  return tct(
    "You already uploaded artifacts with Debug IDs but none of the uploaded source files had a Debug ID matching this stack frame's Debug ID: [debugId]",
    {
      debugId: projectSlug ? (
        <LinkButton
          to={{
            pathname: `/settings/projects/${projectSlug}/source-maps/`,
            query: {
              query: debugId,
            },
          }}
          icon={<IconOpen />}
          aria-label={t('View source map Debug ID %(debugId)s in project settings', {
            debugId,
          })}
          size="xs"
        >
          {debugId}
        </LinkButton>
      ) : (
        <MonoBlock>{debugId}</MonoBlock>
      ),
    }
  );
}

function UploadedSourceFileWithCorrectDebugIdChecklistItem({
  sourceResolutionResults,
  shouldValidate,
  projectSlug,
}: {
  shouldValidate: boolean;
  sourceResolutionResults: FrameSourceMapDebuggerData;
  projectSlug?: string;
}) {
  const platform = getPlatform(sourceResolutionResults);
  const sourceMapsDocLinks = getSourceMapsDocLinks(platform);
  const successMessage = t('Source file with a matching Debug ID was uploaded');
  const errorMessage = t('Missing source file with a matching Debug ID');

  if (!shouldValidate) {
    return <CheckListItem status="none" title={successMessage} />;
  }

  if (sourceResolutionResults.uploadedSourceFileWithCorrectDebugId) {
    return <CheckListItem status="checked" title={successMessage} />;
  }

  if (sourceResolutionResults.uploadedSomeArtifactWithDebugId) {
    return (
      <CheckListItem status="alert" title={errorMessage}>
        <CheckListInstruction variant="muted">
          <h6>{t('No Source File With Matching Debug ID')}</h6>
          <p>
            <DebugIdMismatchMessage
              projectSlug={projectSlug}
              debugId={sourceResolutionResults.stackFrameDebugId}
            />
          </p>
          <p>
            {t(
              'Make sure to inject Debug IDs into all of your source files and to upload all of them to Sentry.'
            )}
          </p>
        </CheckListInstruction>
      </CheckListItem>
    );
  }

  return (
    <CheckListItem status="alert" title={errorMessage}>
      <CheckListInstruction variant="muted">
        <h6>{t('No Artifacts With Debug IDs Uploaded')}</h6>
        <p>
          {tct(
            "You didn't upload any artifacts with debug IDs yet. Read the [link:Sentry Source Maps Documentation] to learn how to inject Debug IDs into your build artifacts and how to upload them to Sentry.",
            {
              link: <ExternalLinkWithIcon href={sourceMapsDocLinks.sourcemaps} />,
            }
          )}
        </p>
        {/* TODO: Link to Uploaded Artifacts */}
      </CheckListInstruction>
    </CheckListItem>
  );
}

function UploadedSourceMapWithCorrectDebugIdChecklistItem({
  sourceResolutionResults,
  shouldValidate,
  projectSlug,
}: {
  shouldValidate: boolean;
  sourceResolutionResults: FrameSourceMapDebuggerData;
  projectSlug?: string;
}) {
  const platform = getPlatform(sourceResolutionResults);
  const sourceMapsDocLinks = getSourceMapsDocLinks(platform);
  const successMessage = t('Uploaded source map with a matching Debug ID');
  const errorMessage = t('Missing source map with a matching Debug ID');

  if (!shouldValidate) {
    return <CheckListItem status="none" title={successMessage} />;
  }

  if (sourceResolutionResults.uploadedSourceMapWithCorrectDebugId) {
    return <CheckListItem status="checked" title={successMessage} />;
  }

  if (sourceResolutionResults.uploadedSomeArtifactWithDebugId) {
    return (
      <CheckListItem status="alert" title={errorMessage}>
        <CheckListInstruction variant="muted">
          <h6>{t('No Source Map With Matching Debug ID')}</h6>
          <p>
            <DebugIdMismatchMessage
              projectSlug={projectSlug}
              debugId={sourceResolutionResults.stackFrameDebugId}
            />
          </p>
          <p>
            {t(
              'Make sure to inject Debug IDs into all of your source files and to upload all of them to Sentry.'
            )}
          </p>
        </CheckListInstruction>
        <SourceMapStepNotRequiredNote />
      </CheckListItem>
    );
  }

  return (
    <CheckListItem status="alert" title={errorMessage}>
      <CheckListInstruction variant="muted">
        <h6>{t('No Artifacts Uploaded')}</h6>
        <p>
          {tct(
            "You didn't upload any artifacts with debug IDs yet. Read the [link:Sentry Source Maps Documentation] to learn how to inject Debug IDs into your build artifacts and how to upload them to Sentry.",
            {
              link: <ExternalLinkWithIcon href={sourceMapsDocLinks.sourcemaps} />,
            }
          )}
        </p>
        {/* TODO: Link to Uploaded Artifacts */}
      </CheckListInstruction>
      <SourceMapStepNotRequiredNote />
    </CheckListItem>
  );
}

function EventHasReleaseNameChecklistItem({
  sourceResolutionResults,
}: {
  sourceResolutionResults: FrameSourceMapDebuggerData;
}) {
  const platform = getPlatform(sourceResolutionResults);
  const sourceMapsDocLinks = getSourceMapsDocLinks(platform);
  const successMessage = t('Event has release value');
  const errorMessage = t("Event doesn't have a release value");

  if (sourceResolutionResults.release !== null) {
    return <CheckListItem status="checked" title={successMessage} />;
  }

  return (
    <CheckListItem status="alert" title={errorMessage}>
      <CheckListInstruction variant="muted">
        <h6>{t('No Release Value')}</h6>
        <p>
          {tct(
            'The captured event does not have a [release] value. Configure a [release] value in the SDK:',
            {release: <MonoBlock>release</MonoBlock>}
          )}
        </p>
        <InstructionCodeSnippet language="javascript" dark hideCopyButton>
          {`Sentry.init({
  release: 'your-release-name'
})`}
        </InstructionCodeSnippet>
        {defined(sourceMapsDocLinks.sentryBundleSupport) && (
          <p>
            {tct(
              'Alternatively, you can configure one of our build tools to automatically inject a release value into your code: [link:Sentry Bundler Support]',
              {
                link: (
                  <ExternalLinkWithIcon href={sourceMapsDocLinks.sentryBundleSupport} />
                ),
              }
            )}
          </p>
        )}
      </CheckListInstruction>
    </CheckListItem>
  );
}

function ReleaseHasUploadedArtifactsChecklistItem({
  sourceResolutionResults,
  shouldValidate,
}: {
  shouldValidate: boolean;
  sourceResolutionResults: FrameSourceMapDebuggerData;
}) {
  const platform = getPlatform(sourceResolutionResults);
  const sourceMapsDocLinks = getSourceMapsDocLinks(platform);
  const successMessage = t('Release has uploaded artifacts');
  const errorMessage = t("Release doesn't have uploaded artifacts");

  if (!shouldValidate) {
    return <CheckListItem status="none" title={successMessage} />;
  }

  if (sourceResolutionResults.releaseHasSomeArtifact) {
    return <CheckListItem status="checked" title={successMessage} />;
  }

  return (
    <CheckListItem status="alert" title={errorMessage}>
      <CheckListInstruction variant="muted">
        <h6>{t('No Uploaded Artifacts')}</h6>
        <p>
          {t(
            "The release this event belongs to doesn't have any uploaded artifacts. Upload your build artifacts to Sentry using the release:"
          )}{' '}
          <MonoBlock>{sourceResolutionResults.release}</MonoBlock>
        </p>
        <p>
          {tct(
            'Read the [link:Sentry Source Maps Documentation] to learn how to to upload your build artifacts to Sentry.',
            {
              link: defined(sourceMapsDocLinks.legacyUploadingMethods) ? (
                <ExternalLinkWithIcon href={sourceMapsDocLinks.legacyUploadingMethods} />
              ) : (
                <Fragment />
              ),
            }
          )}
        </p>
      </CheckListInstruction>
    </CheckListItem>
  );
}

function ReleaseSourceFileMatchingChecklistItem({
  sourceResolutionResults,
  shouldValidate,
}: {
  shouldValidate: boolean;
  sourceResolutionResults: FrameSourceMapDebuggerData;
}) {
  const platform = getPlatform(sourceResolutionResults);
  const sourceMapsDocLinks = getSourceMapsDocLinks(platform);
  const successMessage = t('Stack frame path matches a source file artifact name');
  const errorMessage = t("Stack frame path doesn't match a source file artifact name");

  if (!shouldValidate) {
    return <CheckListItem status="none" title={successMessage} />;
  }

  if (sourceResolutionResults.sourceFileReleaseNameFetchingResult === 'found') {
    return <CheckListItem status="checked" title={successMessage} />;
  }

  if (sourceResolutionResults.sourceFileReleaseNameFetchingResult === 'wrong-dist') {
    return (
      <CheckListItem status="alert" title={errorMessage}>
        <CheckListInstruction variant="muted">
          <h6>{t('Dist Value Not Matching')}</h6>
          <p>
            {t(
              'You uploaded a source file artifact with the right name, however the dist value on this event does not match the dist value on the artifact.'
            )}
          </p>
          {sourceResolutionResults.dist === null ? (
            <p>
              {tct(
                'Upload your build artifacts to Sentry using a matching [dist] value or adjust the [dist] value in your SDK options.',
                {dist: <MonoBlock>dist</MonoBlock>}
              )}
            </p>
          ) : (
            <p>
              {tct(
                'Upload your build artifacts to Sentry using the dist [dist] or adjust the dist value in your SDK options.',
                {dist: <MonoBlock>{sourceResolutionResults.dist}</MonoBlock>}
              )}
            </p>
          )}
          <DistCodeSnippet />
          {/* TODO: Link to Uploaded Artifacts */}
        </CheckListInstruction>
      </CheckListItem>
    );
  }

  if (sourceResolutionResults.stackFramePath === null) {
    return (
      <CheckListItem status="alert" title={errorMessage}>
        <CheckListInstruction variant="muted">
          <h6>{t('Stack Frame Without Path')}</h6>
          <p>
            {t(
              "This stack frame doesn't have a path. Check your SDK configuration to send a stack frame path!"
            )}
          </p>
        </CheckListInstruction>
      </CheckListItem>
    );
  }

  return (
    <CheckListItem status="alert" title={errorMessage}>
      <CheckListInstruction variant="muted">
        <h6>{t('Stack Frame Not Matching Artifact Name')}</h6>
        <p>
          {tct(
            'The path for this stack frame is [stackFramePath] and the release value for this event is [release].',
            {
              stackFramePath: (
                <MonoBlock>{sourceResolutionResults.stackFramePath}</MonoBlock>
              ),
              release: <MonoBlock>{sourceResolutionResults.release}</MonoBlock>,
            }
          )}
        </p>
        <p>
          {t(
            "Sentry was not able to find a file in the release's artifacts that matches one of the following paths:"
          )}
        </p>
        <InstructionList>
          {sourceResolutionResults.matchingSourceFileNames.map(mathingSourceFileName => (
            <li key={mathingSourceFileName}>
              <MonoBlock>{mathingSourceFileName}</MonoBlock>
            </li>
          ))}
        </InstructionList>
        <p>
          {/* wrong-dist is not deterministically returned in the case of wrong dist values because of database restrictions */}
          {sourceResolutionResults.dist === null
            ? t(
                "This event doesn't have a dist value. Please check that you uploaded your artifacts without dist value."
              )
            : tct(
                'This event has a dist value [dist]. Please check that you uploaded your artifacts with dist [dist].',
                {
                  dist: <MonoBlock>{sourceResolutionResults.dist}</MonoBlock>,
                }
              )}
        </p>
        {/* TODO: Link to uploaded files for this release. */}
        {defined(sourceMapsDocLinks.rewriteFrames) && (
          <p>
            {tct(
              'If the stack frame path is changing based on runtime parameters, you can use the [link:RewriteFrames integration] to dynamically change the stack frame path.',
              {
                link: <ExternalLinkWithIcon href={sourceMapsDocLinks.rewriteFrames} />,
              }
            )}
          </p>
        )}
      </CheckListInstruction>
    </CheckListItem>
  );
}

function ReleaseSourceMapMatchingChecklistItem({
  sourceResolutionResults,
  shouldValidate,
}: {
  shouldValidate: boolean;
  sourceResolutionResults: FrameSourceMapDebuggerData;
}) {
  const successMessage = t('Source map reference matches a source map artifact name');
  const errorMessage = t("Source map reference doesn't match a source map artifact name");

  if (!shouldValidate) {
    return <CheckListItem status="none" title={successMessage} />;
  }

  if (sourceResolutionResults.sourceMapReleaseNameFetchingResult === 'found') {
    return <CheckListItem status="checked" title={successMessage} />;
  }

  if (sourceResolutionResults.releaseSourceMapReference === null) {
    return (
      <CheckListItem status="alert" title={errorMessage}>
        <CheckListInstruction variant="muted">
          <h6>{t('Missing Source Map Reference')}</h6>
          <p>
            {tct(
              'The source file for this stack frame is missing a source map reference. A source map reference is usually represented by a [sourceMappingUrl] comment at the bottom of your source file.',
              {sourceMappingUrl: <MonoBlock>{'//# sourceMappingURL=...'}</MonoBlock>}
            )}
          </p>
          <p>
            {tct(
              'You can fix this by configuring your build tool to emit a [sourceMappingUrl] comment.',
              {sourceMappingUrl: <MonoBlock>sourceMappingURL</MonoBlock>}
            )}
          </p>
        </CheckListInstruction>
        <SourceMapStepNotRequiredNote />
      </CheckListItem>
    );
  }

  if (sourceResolutionResults.sourceMapReleaseNameFetchingResult === 'wrong-dist') {
    return (
      <CheckListItem status="alert" title={errorMessage}>
        <CheckListInstruction variant="muted">
          <h6>{t('Dist Value Not Matching')}</h6>
          <p>
            {t(
              'You uploaded a source map artifact with the right name, however the dist value on this event does not match the dist value on the artifact.'
            )}
          </p>
          {sourceResolutionResults.dist === null ? (
            <p>
              {tct(
                'Upload your build artifacts to Sentry using a matching [dist] value or adjust the [dist] value in your SDK options.',
                {dist: <MonoBlock>dist</MonoBlock>}
              )}
            </p>
          ) : (
            <p>
              {tct(
                'Upload your build artifacts to Sentry using the dist [dist] or adjust the dist value in your SDK options.',
                {dist: <MonoBlock>{sourceResolutionResults.dist}</MonoBlock>}
              )}
            </p>
          )}
          <DistCodeSnippet />
          {/* TODO: Link to Uploaded Artifacts */}
        </CheckListInstruction>
      </CheckListItem>
    );
  }

  return (
    <CheckListItem status="alert" title={errorMessage}>
      <CheckListInstruction variant="muted">
        <h6>{t('Not Found')}</h6>
        <p>
          {tct(
            'The source file had a source map reference [sourceMapReference], but there was no source map artifact uploaded at that location. Make sure to generate and upload a source map named [matchingSourceMap] to symbolicate this stack frame!',
            {
              sourceMapReference: (
                <MonoBlock>{sourceResolutionResults.releaseSourceMapReference}</MonoBlock>
              ),
              matchingSourceMap: (
                <MonoBlock>{sourceResolutionResults.matchingSourceMapName}</MonoBlock>
              ),
            }
          )}
        </p>
        <p>
          {/* wrong-dist is not deterministically returned in the case of wrong dist values because of database restrictions */}
          {sourceResolutionResults.dist === null
            ? t(
                "This event doesn't have a dist value. Please check that you uploaded your sourcemaps without dist value."
              )
            : tct(
                'This event has a dist value [dist]. Please check that you uploaded your sourcemaps with dist [dist].',
                {
                  dist: <MonoBlock>{sourceResolutionResults.dist}</MonoBlock>,
                }
              )}
        </p>
        {/* TODO: Link to Uploaded Artifacts */}
      </CheckListInstruction>
      <SourceMapStepNotRequiredNote />
    </CheckListItem>
  );
}

function ScrapingSourceFileAvailableChecklistItem({
  sourceResolutionResults,
}: {
  sourceResolutionResults: FrameSourceMapDebuggerData;
}) {
  if (sourceResolutionResults.sourceFileScrapingStatus === null) {
    return (
      <CheckListItem status="alert" title={t('Source file was not fetched')}>
        <CheckListInstruction variant="muted">
          <h6>{t('Missing Information')}</h6>
          <p>
            {t(
              'This stack frame is missing information to attempt fetching the source file.'
            )}
          </p>
        </CheckListInstruction>
        <SourceMapStepNotRequiredNote />
      </CheckListItem>
    );
  }

  if (sourceResolutionResults.sourceFileScrapingStatus.status === 'success') {
    return (
      <CheckListItem status="checked" title={t('Source file available to Sentry')} />
    );
  }

  if (sourceResolutionResults.sourceFileScrapingStatus.status === 'not_attempted') {
    return (
      <CheckListItem status="alert" title={t('Source file was not fetched')}>
        <CheckListInstruction variant="muted">
          <h6>{t('Fetching Was Not Attempted')}</h6>
          <p>
            {t(
              'The source file was already located via Debug IDs or Releases. Sentry will only attempt to fetch the source file from your servers as a fallback mechanism.'
            )}
          </p>
        </CheckListInstruction>
        <SourceMapStepNotRequiredNote />
      </CheckListItem>
    );
  }

  const failureReasonTexts =
    (SOURCE_FILE_SCRAPING_REASON_MAP as any)[
      sourceResolutionResults.sourceFileScrapingStatus.reason
    ] ?? SOURCE_FILE_SCRAPING_REASON_MAP.other;

  return (
    <CheckListItem status="alert" title={t('Source file is not available to Sentry')}>
      <CheckListInstruction variant="muted">
        <h6>
          {t('Error While Fetching The Source File:')} {failureReasonTexts.shortName}
        </h6>
        <p>{failureReasonTexts.explanation}</p>
        <p>
          {t('Sentry looked for the source file at this location:')}{' '}
          <MonoBlock>{sourceResolutionResults.sourceFileScrapingStatus.url}</MonoBlock>
        </p>
        {sourceResolutionResults.sourceFileScrapingStatus.details && (
          <Fragment>
            <p>{t('Sentry symbolification error message:')}</p>
            <ScrapingSymbolificationErrorMessage>
              "{sourceResolutionResults.sourceFileScrapingStatus.details}"
            </ScrapingSymbolificationErrorMessage>
          </Fragment>
        )}
      </CheckListInstruction>
    </CheckListItem>
  );
}

function ScrapingSourceMapAvailableChecklistItem({
  sourceResolutionResults,
}: {
  sourceResolutionResults: FrameSourceMapDebuggerData;
}) {
  if (sourceResolutionResults.sourceMapScrapingStatus?.status === 'success') {
    return <CheckListItem status="checked" title={t('Source map available to Sentry')} />;
  }

  if (sourceResolutionResults.sourceFileScrapingStatus?.status !== 'success') {
    return <CheckListItem status="none" title={t('Source map available to Sentry')} />;
  }

  if (sourceResolutionResults.sourceMapScrapingStatus === null) {
    return (
      <CheckListItem status="none" title={t('Source map was not fetched')}>
        <CheckListInstruction variant="muted">
          <h6>{t('No Source Map Reference')}</h6>
          <p>{t('There was no source map reference on the source file.')}</p>
        </CheckListInstruction>
        <SourceMapStepNotRequiredNote />
      </CheckListItem>
    );
  }

  if (sourceResolutionResults.sourceMapScrapingStatus.status === 'not_attempted') {
    return (
      <CheckListItem status="alert" title={t('Source map was not fetched')}>
        <CheckListInstruction variant="muted">
          <h6>{t('Fetching Was Not Attempted')}</h6>
          <p>
            {t(
              'The source map was already located via Debug IDs or Releases. Sentry will only attempt to fetch the source map from your servers as a fallback mechanism.'
            )}
          </p>
        </CheckListInstruction>
        <SourceMapStepNotRequiredNote />
      </CheckListItem>
    );
  }

  const failureReasonTexts =
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    SOURCE_MAP_SCRAPING_REASON_MAP[
      sourceResolutionResults.sourceMapScrapingStatus.reason
    ] ?? SOURCE_MAP_SCRAPING_REASON_MAP.other;

  return (
    <CheckListItem status="alert" title={t('Source map is not available to Sentry')}>
      <CheckListInstruction variant="muted">
        <h6>
          {t('Error While Fetching The Source Map:')} {failureReasonTexts.shortName}
        </h6>
        <p>{failureReasonTexts.explanation}</p>
        <p>
          {t('Sentry looked for the source map at this location:')}{' '}
          <MonoBlock>{sourceResolutionResults.sourceMapScrapingStatus.url}</MonoBlock>
        </p>
        {sourceResolutionResults.sourceMapScrapingStatus.details && (
          <Fragment>
            <p>{t('Sentry symbolification error message:')}</p>
            <ScrapingSymbolificationErrorMessage>
              "{sourceResolutionResults.sourceMapScrapingStatus.details}"
            </ScrapingSymbolificationErrorMessage>
          </Fragment>
        )}
      </CheckListInstruction>
    </CheckListItem>
  );
}

function ExternalLinkWithIcon({href, children}: PropsWithChildren<{href: string}>) {
  return (
    <ExternalLink href={href}>
      {children} <IconOpen size="xs" />
    </ExternalLink>
  );
}

function DistCodeSnippet() {
  return (
    <InstructionCodeSnippet language="javascript" dark hideCopyButton>
      {`Sentry.init({
  dist: 'your-dist-name'
})`}
    </InstructionCodeSnippet>
  );
}

function VerifyAgainNote() {
  return (
    <CompletionNoteContainer>
      <IconRefresh size="lg" variant="muted" />
      <p>
        {t(
          'Once you changed your configuration, redeploy your app and capture a new event to verify your changes!'
        )}
      </p>
    </CompletionNoteContainer>
  );
}

function ChecklistDoneNote() {
  const isSelfHosted = ConfigStore.get('isSelfHosted');
  return (
    <CompletionNoteContainer>
      <IconCheckmark size="md" variant="success" />
      <p>
        {t(
          'You completed all of the steps above. Capture a new event to verify your setup!'
        )}
        {isSelfHosted
          ? tct(
              ' If the newly captured event is still not sourcemapped, please check the logs of the [symbolicator] service of your self-hosted instance.',
              {
                symbolicator: <MonoBlock>symbolicator</MonoBlock>,
              }
            )
          : ''}
      </p>
    </CompletionNoteContainer>
  );
}

function SourceMapStepNotRequiredNote() {
  return (
    <CheckListInstruction variant="muted">
      {
        "You can safely ignore this step if you don't do any transformations to your code before deploying."
      }
    </CheckListInstruction>
  );
}

const StyledTabPanels = styled(TabPanels)<{hideAllTabs: boolean}>`
  ${p => !p.hideAllTabs && `padding-top: ${space(2)};`}
`;

const CheckList = styled('ul')`
  margin: 0;
  padding: 0 ${space(1.5)};
  list-style-type: none;
`;

interface CheckListItemProps {
  status: 'none' | 'checked' | 'alert' | 'question';
  title: ReactNode;
}

const ListItemContainer = styled('li')`
  display: flex;

  &:last-of-type {
    .source-map-debugger-modal-checklist-line {
      display: none;
    }
  }
`;

const Line = styled('div')`
  margin: ${space(0.5)} 0;
  flex-grow: 1;
  width: ${space(0.25)};
  background-color: ${p => p.theme.colors.gray200};
  border-radius: ${space(0.25)};
`;

const ListItemContentContainer = styled('div')`
  flex-grow: 1;
  margin-left: ${space(1.5)};
  padding-bottom: ${space(2)};
  max-width: 100%;
`;

const CompletionNoteContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(2)};
  margin-top: ${space(1)};
  margin-bottom: ${space(0.5)};
  padding: 0 ${space(2)} 0 0;
`;

const ListItemTitle = styled('p')<{status: 'none' | 'checked' | 'alert' | 'question'}>`
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p =>
    ({
      none: p.theme.tokens.content.secondary,
      question: p.theme.tokens.content.secondary,
      alert: p.theme.colors.yellow500,
      checked: p.theme.colors.green400,
    })[p.status]};
`;

const CheckListInstruction = styled(Alert)`
  width: 100%;
  margin-top: ${space(1)};
  overflow-x: auto;

  h6 {
    font-size: 1rem;
    margin-bottom: ${space(1)};
  }

  p {
    margin-bottom: ${space(1.5)};
  }
`;

const MonoBlock = styled('code')`
  padding: ${space(0.25)} ${space(0.5)};
  color: ${p => p.theme.colors.gray500};
  background: ${p => p.theme.colors.gray100};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.xs};
  font-weight: ${p => p.theme.fontWeight.normal};
  white-space: nowrap;
`;

const StyledProgressRing = styled(ProgressRing)`
  margin-right: ${space(0.5)};
`;

const WizardInstructionParagraph = styled('p')`
  margin-bottom: ${space(1)};
`;

const InstructionCodeSnippet = styled(CodeBlock)`
  margin: ${space(1)} 0 ${space(2)};
`;

const InstructionList = styled('ul')`
  margin-bottom: ${space(1.5)};

  li {
    margin-bottom: ${space(0.5)};
  }
`;

const ScrapingSymbolificationErrorMessage = styled('p')`
  color: ${p => p.theme.tokens.content.secondary};
  border-left: 2px solid ${p => p.theme.colors.gray200};
  padding-left: ${space(1)};
  margin-top: -${space(1)};
`;

const DebuggerSectionContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1.5)};
  h5 {
    margin-bottom: 0;
    font-size: ${p => p.theme.fontSize.xl};
  }
  h6 {
    font-size: 1rem;
  }
  && {
    > * {
      margin-bottom: 0;
      margin-top: 0;
    }
  }
  margin-bottom: ${space(3)};
`;
