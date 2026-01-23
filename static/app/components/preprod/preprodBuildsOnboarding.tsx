import {useEffect} from 'react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {SetupTitle} from 'sentry/components/updatedEmptyState';
import {t, tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeInteger} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

type OnboardingStep = {
  content: React.ReactNode;
  key: string;
  title: string;
  codeBlock?: string;
  docsLink?: string;
};

const ANDROID_GRADLE_STEPS: OnboardingStep[] = [
  {
    key: 'install',
    title: t('Install the Sentry Gradle Plugin'),
    content: (
      <Text>
        {tct(
          'Add the Sentry Gradle plugin to your [buildGradle] or [settingsGradle] file:',
          {
            buildGradle: <code>build.gradle</code>,
            settingsGradle: <code>settings.gradle</code>,
          }
        )}
      </Text>
    ),
    codeBlock: `plugins {
  id "io.sentry.android.gradle" version "{{@inject packages.version('sentry.java.android.gradle-plugin', '4.14.1') }}"
}`,
    docsLink: 'https://docs.sentry.io/platforms/android/configuration/gradle/',
  },
  {
    key: 'configure',
    title: t('Configure the Plugin'),
    content: (
      <Text>
        {t(
          'Apply the plugin and configure it with your DSN. The plugin will automatically upload build size and distribution data.'
        )}
      </Text>
    ),
    codeBlock: `sentry {
  org = "your-org"
  projectName = "your-project"
  authToken = System.getenv("SENTRY_AUTH_TOKEN")

  autoUploadProguardMapping = true
  uploadNativeSymbols = true
}`,
    docsLink: 'https://docs.sentry.io/platforms/android/configuration/gradle/',
  },
  {
    key: 'upload',
    title: t('Run Your Build'),
    content: (
      <Text>
        {t(
          'Build your app as usual. The Sentry Gradle plugin will automatically upload size and distribution metrics during the build process.'
        )}
      </Text>
    ),
    codeBlock: `./gradlew assembleRelease`,
    docsLink: 'https://docs.sentry.io/product/size-analysis/',
  },
];

const IOS_FASTLANE_STEPS: OnboardingStep[] = [
  {
    key: 'install',
    title: t('Install the Sentry Fastlane Plugin'),
    content: (
      <Text>
        {tct('Add the Sentry Fastlane plugin to your [pluginfile]:', {
          pluginfile: <code>Pluginfile</code>,
        })}
      </Text>
    ),
    codeBlock: `gem 'fastlane-plugin-sentry'`,
    docsLink:
      'https://docs.sentry.io/platforms/apple/guides/ios/upload-debug-symbols/fastlane/',
  },
  {
    key: 'configure',
    title: t('Configure the Plugin'),
    content: (
      <Text>
        {tct('Add the [sentryUploadBuild] action to your [fastfile]:', {
          sentryUploadBuild: <code>sentry_upload_build</code>,
          fastfile: <code>Fastfile</code>,
        })}
      </Text>
    ),
    codeBlock: `lane :beta do
  # ... your existing build steps

  sentry_upload_build(
    org_slug: 'your-org',
    project_slug: 'your-project',
    auth_token: ENV['SENTRY_AUTH_TOKEN']
  )
end`,
    docsLink:
      'https://docs.sentry.io/platforms/apple/guides/ios/upload-debug-symbols/fastlane/',
  },
  {
    key: 'upload',
    title: t('Run Your Lane'),
    content: (
      <Text>
        {t(
          'Run your fastlane lane as usual. The Sentry plugin will automatically upload size and distribution metrics.'
        )}
      </Text>
    ),
    codeBlock: `fastlane beta`,
    docsLink: 'https://docs.sentry.io/product/size-analysis/',
  },
];

const GENERIC_STEPS: OnboardingStep[] = [
  {
    key: 'get_started',
    title: t('Get Started'),
    content: (
      <Stack gap="md">
        <Text>
          {t(
            'Track mobile app build size changes and distribution metrics to identify issues before they reach production.'
          )}
        </Text>
        <Stack gap="sm">
          <LinkButton
            size="sm"
            href="https://docs.sentry.io/product/size-analysis/"
            external
          >
            {t('Size Analysis Documentation')}
          </LinkButton>
          <LinkButton
            size="sm"
            href="https://docs.sentry.io/product/build-distribution/"
            external
          >
            {t('Build Distribution Documentation')}
          </LinkButton>
        </Stack>
      </Stack>
    ),
  },
];

type Props = {
  organization: Organization;
  projectId: string;
};

export function PreprodBuildsOnboarding({organization, projectId}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const project = ProjectsStore.getById(projectId);
  const platform = project?.platform;

  const isAndroid = platform === 'android';
  const isIOS = platform?.startsWith('apple');

  const steps = isAndroid
    ? ANDROID_GRADLE_STEPS
    : isIOS
      ? IOS_FASTLANE_STEPS
      : GENERIC_STEPS;

  useEffect(() => {
    if (project) {
      trackAnalytics('preprod.builds.onboarding.viewed', {
        organization,
        platform,
        project_id: projectId,
      });
    }
  }, [organization, platform, project, projectId]);

  const handleStepChange = (step: number) => {
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        guidedStep: step,
      },
    });

    const stepKey = steps[step - 1]?.key;
    if (stepKey) {
      trackAnalytics('preprod.builds.onboarding.step_completed', {
        organization,
        step_key: stepKey,
        platform,
      });
    }
  };

  const handleDocsClick = (linkType: 'fastlane' | 'gradle' | 'generic') => {
    trackAnalytics('preprod.builds.onboarding.docs_clicked', {
      organization,
      link_type: linkType,
      platform,
    });
  };

  if (!project) {
    return <LoadingIndicator />;
  }

  return (
    <Panel>
      <PanelBody>
        <HeaderWrapper>
          <Heading as="h2">{t('Track your mobile app builds')}</Heading>
          <SubTitle>
            {t(
              'Monitor size changes and distribution metrics to catch issues before they reach production. Set up automated tracking for your iOS or Android builds.'
            )}
          </SubTitle>
        </HeaderWrapper>
        <Divider />
        <Setup>
          <SetupTitle project={project} />
          <GuidedSteps
            initialStep={decodeInteger(location.query.guidedStep)}
            onStepChange={handleStepChange}
          >
            {steps.map((step, index) => {
              return (
                <GuidedSteps.Step key={step.key} stepKey={step.title} title={step.title}>
                  <Stack gap="md">
                    {step.content}
                    {step.codeBlock && (
                      <CodeBlock>
                        <code>{step.codeBlock}</code>
                      </CodeBlock>
                    )}
                    {step.docsLink && (
                      <LinkButton
                        size="sm"
                        href={step.docsLink}
                        external
                        onClick={() => {
                          const linkType = isAndroid
                            ? 'gradle'
                            : isIOS
                              ? 'fastlane'
                              : 'generic';
                          handleDocsClick(linkType);
                        }}
                      >
                        {t('View Documentation')}
                      </LinkButton>
                    )}
                  </Stack>
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
        </Setup>
      </PanelBody>
    </Panel>
  );
}

const SubTitle = styled(Text)`
  margin-bottom: ${space(1)};
`;

const HeaderWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  border-radius: ${p => p.theme.radius.md};
  padding: ${space(4)};
`;

const Setup = styled('div')`
  padding: ${space(4)};
`;

const Divider = styled('hr')`
  height: 1px;
  width: 95%;
  background: ${p => p.theme.tokens.border.primary};
  border: none;
  margin-top: 0;
  margin-bottom: 0;
`;

const CodeBlock = styled('div')`
  background: ${p => p.theme.tokens.background.secondary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  padding: ${space(2)};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  overflow-x: auto;

  code {
    white-space: pre;
  }
`;
