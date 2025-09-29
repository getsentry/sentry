import {useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import emptyBuildImg from 'sentry-images/spot/releases-tour-commits.svg';

import {Alert} from 'sentry/components/core/alert';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Container, Flex} from 'sentry/components/core/layout';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import {Heading, Text} from 'sentry/components/core/text';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {OnboardingCodeSnippet} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {t, tct} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/project';

interface PreprodOnboardingProps {
  organizationSlug: string;
  projectPlatform: PlatformKey | null;
  projectSlug: string;
}

type UploadMethod = 'fastlane' | 'gradle' | 'cli';

function FastlaneMethod({
  organizationSlug,
  projectPlatform,
  projectSlug,
}: {
  organizationSlug: string;
  projectPlatform: PlatformKey | null;
  projectSlug: string;
}) {
  const isIOS = projectPlatform?.includes('apple') || projectPlatform?.includes('ios');

  return (
    <Flex direction="column" gap="2xl">
      {!isIOS && (
        <Alert type="info" showIcon>
          {t('Fastlane is for iOS applications only')}
        </Alert>
      )}
      <Container>
        <Text as="p" size="md">
          Add to your fastlane/Pluginfile:
        </Text>
        <OnboardingCodeSnippet language="ruby">
          {`gem 'fastlane-plugin-sentry', git: 'https://github.com/getsentry/sentry-fastlane-plugin.git', ref: 'b0c36a1472a6bfde0a4766c612c1154706dbd014'`}
        </OnboardingCodeSnippet>
      </Container>

      <Container>
        <Text as="p" size="md">
          Add a lane to your Fastfile:
        </Text>
        <OnboardingCodeSnippet language="ruby">
          {`sentry_upload_build(
  org_slug: '${organizationSlug}',
  project_slug: '${projectSlug}',
  base_ref: ENV['GITHUB_BASE_REF'],
  base_sha: ENV['GITHUB_BASE_SHA'],
  head_ref: ENV['GITHUB_HEAD_REF'] || ENV['GITHUB_REF']&.sub('refs/heads/', ''),
  head_sha: ENV['SENTRY_SHA'],
)`}
        </OnboardingCodeSnippet>
      </Container>

      <Container>
        <Text as="p" size="md">
          Set environment variables in your GitHub Action:
        </Text>
        <OnboardingCodeSnippet language="yaml">
          {`env:
  SENTRY_AUTH_TOKEN: \${{ secrets.SENTRY_AUTH_TOKEN }}
  SENTRY_CONFIGURATION: Release
  GITHUB_BASE_SHA: \${{ github.event.pull_request.base.sha }}
  SENTRY_SHA: \${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}`}
        </OnboardingCodeSnippet>
      </Container>
    </Flex>
  );
}

function GradleMethod({projectPlatform}: {projectPlatform: PlatformKey | null}) {
  const isAndroid = projectPlatform?.includes('android');

  return (
    <Flex direction="column" gap="2xl">
      {!isAndroid && (
        <Alert type="info" showIcon>
          {t('Gradle Plugin is for Android applications only')}
        </Alert>
      )}
      <Container>
        <Text as="p" size="md">
          Apply the plugin (use version 6.0.0-alpha.3):
        </Text>
        <OnboardingCodeSnippet language="kotlin">
          {`plugins {
  id "io.sentry.android.gradle" version "6.0.0-alpha.3"
}`}
        </OnboardingCodeSnippet>
      </Container>

      <Container>
        <Text as="p" size="md">
          Configure the plugin:
        </Text>
        <OnboardingCodeSnippet language="kotlin">
          {`sentry {
  sizeAnalysis {
    enabled = true
  }

  vcsInfo {
    fun env(key: String): String? = System.getenv(key)?.takeIf { it.isNotEmpty() }

    (env("GITHUB_HEAD_REF") ?: env("GITHUB_REF")?.removePrefix("refs/heads/"))?.let { headRef.set(it) }
    env("GITHUB_BASE_REF")?.let { baseRef.set(it) }
    env("GITHUB_BASE_SHA")?.let { baseSha.set(it) }
    env("SENTRY_SHA")?.let { headSha.set(it) }
  }
}`}
        </OnboardingCodeSnippet>
      </Container>

      <Container>
        <Text as="p" size="md">
          Set environment variables in GitHub Actions:
        </Text>
        <OnboardingCodeSnippet language="yaml">
          {`env:
  SENTRY_AUTH_TOKEN: \${{ secrets.SENTRY_AUTH_TOKEN }}
  GITHUB_BASE_SHA: \${{ github.event.pull_request.base.sha }}
  SENTRY_SHA: \${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}`}
        </OnboardingCodeSnippet>
      </Container>
    </Flex>
  );
}

function CliMethod({
  organizationSlug,
  projectSlug,
}: {
  organizationSlug: string;
  projectSlug: string;
}) {
  return (
    <Flex direction="column" gap="2xl">
      <Container>
        <Text as="p" size="md">
          {tct('Install the [link:Sentry CLI]', {
            link: (
              <ExternalLink
                href="https://docs.sentry.io/cli/installation/"
                target="_blank"
                rel="noreferrer"
              />
            ),
          })}
        </Text>
        <OnboardingCodeSnippet language="bash">
          {`# Using npm
npm install -g @sentry/cli

# Using curl
curl -sL https://sentry.io/get-cli/ | bash`}
        </OnboardingCodeSnippet>
      </Container>

      <Container>
        <Text as="p" size="md">
          Upload your build using the CLI:
        </Text>
        <OnboardingCodeSnippet language="bash">
          {`sentry-cli build upload <path-to-apk|aab|xcarchive> \\
  --org ${organizationSlug} \\
  --project ${projectSlug} \\
  --head-sha <sha> \\
  --base-sha <sha> \\
  --head-repo-name <org/repo> \\
  --pr-number <pr-number> \\
  --vcs-provider github \\
  --build-configuration <build-config>`}
        </OnboardingCodeSnippet>
      </Container>

      <Container>
        <Text as="p" size="md">
          Set these environment variables in your CI:
        </Text>
        <OnboardingCodeSnippet language="bash">
          {`export SENTRY_AUTH_TOKEN=<your-auth-token>
# These are set automatically in GitHub Actions:
# --repo-name, --vcs-provider, --pr-number`}
        </OnboardingCodeSnippet>
      </Container>
    </Flex>
  );
}

export function PreprodOnboarding({
  organizationSlug,
  projectPlatform,
  projectSlug,
}: PreprodOnboardingProps) {
  const theme = useTheme();
  const isIOS = projectPlatform?.includes('apple') || projectPlatform?.includes('ios');
  const isAndroid = projectPlatform?.includes('android');

  let availableMethods: Array<{label: string; value: UploadMethod}>;
  let defaultMethod: UploadMethod;
  let platformLabel: string | null = null;

  if (isIOS) {
    availableMethods = [
      {label: 'Fastlane', value: 'fastlane'},
      {label: 'Sentry CLI', value: 'cli'},
    ];
    defaultMethod = 'fastlane';
    platformLabel = 'iOS';
  } else if (isAndroid) {
    availableMethods = [
      {label: 'Gradle Plugin', value: 'gradle'},
      {label: 'Sentry CLI', value: 'cli'},
    ];
    defaultMethod = 'gradle';
    platformLabel = 'Android';
  } else {
    availableMethods = [
      {label: 'Sentry CLI', value: 'cli'},
      {label: 'Gradle Plugin', value: 'gradle'},
      {label: 'Fastlane', value: 'fastlane'},
    ];
    defaultMethod = 'cli';
  }

  const [selectedMethod, setSelectedMethod] = useState<UploadMethod>(defaultMethod);

  const renderMethodContent = () => {
    switch (selectedMethod) {
      case 'fastlane':
        return (
          <FastlaneMethod
            organizationSlug={organizationSlug}
            projectPlatform={projectPlatform}
            projectSlug={projectSlug}
          />
        );
      case 'gradle':
        return <GradleMethod projectPlatform={projectPlatform} />;
      case 'cli':
      default:
        return (
          <CliMethod organizationSlug={organizationSlug} projectSlug={projectSlug} />
        );
    }
  };

  return (
    <Panel>
      <PanelBody>
        <Flex padding="3xl" gap="2xl" direction="column">
          <Flex justify="between" align="center" gap="xl">
            <Container>
              <Heading as="h1" size="2xl">
                {t('Upload Builds to Sentry')}
              </Heading>
              <Text as="p" size="md" style={{marginBottom: theme.space.md}}>
                {t('Monitor & reduce your app size and distribute pre-release builds')}
              </Text>
              <List symbol="bullet">
                <ListItem>
                  {t('Get automated checks size regressions and distributable builds')}
                </ListItem>
                <ListItem>
                  {t('See actionable insights on how to reduce your app size')}
                </ListItem>
                <ListItem>{t('Distribute pre-release builds to your team')}</ListItem>
              </List>
            </Container>
            <Image src={emptyBuildImg} />
          </Flex>
          <Divider />
          <Flex direction="column" gap="2xl">
            <Container>
              <Heading as="h3" size="lg" style={{marginBottom: theme.space.xl}}>
                {t('Prerequisites')}
              </Heading>
              <Text as="p" size="md">
                {tct(
                  'You need a Sentry Auth Token to upload builds. [link:Generate one here] and set it as [code:SENTRY_AUTH_TOKEN] in your environment.',
                  {
                    link: <Link to={`/settings/${organizationSlug}/auth-tokens/`} />,
                    code: <code />,
                  }
                )}
              </Text>
            </Container>

            <Flex direction="column" gap="md">
              <Flex align="center" gap="sm">
                <Heading as="h3" size="lg">
                  {t('Uploading %s Builds', platformLabel || 'Mobile')}
                </Heading>
              </Flex>
              <Container borderBottom="primary">
                <Tabs value={selectedMethod} onChange={setSelectedMethod}>
                  <TabList>
                    {availableMethods.map(method => (
                      <TabList.Item key={method.value} textValue={method.label}>
                        {method.label}
                      </TabList.Item>
                    ))}
                  </TabList>
                </Tabs>
              </Container>
            </Flex>
            {renderMethodContent()}

            <Flex direction="column" gap="md">
              <Heading as="h3" size="lg">
                Integrating into CI
              </Heading>
              <Text as="p" size="md">
                Integrating the GitHub App is required for PR annotations and workflow
                automation
              </Text>

              <Flex gap="xl" wrap="wrap">
                <LinkButton
                  priority="primary"
                  href="/settings/integrations/github"
                  size="md"
                >
                  Install GitHub App
                </LinkButton>
                <LinkButton
                  href="https://docs.sentry.io/product/builds/"
                  external
                  disabled
                  size="md"
                >
                  View Documentation
                </LinkButton>
              </Flex>
            </Flex>
          </Flex>
        </Flex>
      </PanelBody>
    </Panel>
  );
}

const Image = styled('img')`
  display: block;
  pointer-events: none;
  height: 120px;
  overflow: hidden;

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    display: none;
  }
`;

const Divider = styled('hr')`
  height: 1px;
  width: 100%;
  background: ${p => p.theme.border};
  border: none;
  margin: 0;
`;
