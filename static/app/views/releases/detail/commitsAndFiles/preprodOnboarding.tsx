import {useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import emptyBuildImg from 'sentry-images/spot/releases-tour-commits.svg';

import {Alert} from '@sentry/scraps/alert';

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
          {t(
            'Make sure you are using 1.34.0 or higher of the sentry-fastlane-plugin. If you are using fastlane but do not have the fastlane plugin, you can install it with:'
          )}
        </Text>
        <OnboardingCodeSnippet language="bash">
          {`bundle exec fastlane add_plugin fastlane-plugin-sentry`}
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
  build_configuration: 'Release' # Adjust to your build configuration
)`}
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
          {tct(
            'Update your Sentry Android Gradle Plugin to [code:6.0.0-alpha.4]. For installation instructions, see the [link:Android Gradle configuration guide].',
            {
              code: <code />,
              link: (
                <ExternalLink
                  href="https://docs.sentry.io/platforms/android/configuration/gradle/"
                  target="_blank"
                  rel="noreferrer"
                />
              ),
            }
          )}
        </Text>
      </Container>

      <Container>
        <Text as="p" size="md">
          Configure the plugin:
        </Text>
        <OnboardingCodeSnippet language="kotlin">
          {`sentry {
  sizeAnalysis {
    enabled = providers.environmentVariable("GITHUB_ACTIONS").isPresent
  }
}`}
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
          {tct('[link:Install the Sentry CLI]', {
            link: (
              <ExternalLink
                href="https://docs.sentry.io/cli/installation/"
                target="_blank"
                rel="noreferrer"
              />
            ),
          })}
        </Text>
      </Container>

      <Container>
        <Text as="p" size="md">
          {t("Upload your build using the CLI's build upload command:")}
        </Text>
        <OnboardingCodeSnippet language="bash">
          {`sentry-cli build upload <path-to-apk|aab|xcarchive> \\
  --org ${organizationSlug} \\
  --project ${projectSlug} \\
  --head-sha <sha> \\
  --base-sha <sha> \\
  --head-ref <ref> \\
  --base-ref <ref> \\
  --head-repo-name <org/repo> \\
  --pr-number <pr-number> \\
  --vcs-provider github \\
  --build-configuration <build-config>`}
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
                  'You need a Sentry organization auth token to upload builds. [link:Generate one here] and set it as [code:SENTRY_AUTH_TOKEN] in your environment.',
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
                {t('Integrating into CI')}
              </Heading>
              <Text as="p" size="md">
                {t(
                  'Integrating the GitHub App is required for PR annotations and workflow automation'
                )}
              </Text>

              <Flex gap="xl" wrap="wrap">
                <LinkButton
                  priority="primary"
                  href="/settings/integrations/github"
                  size="md"
                >
                  {t('Install GitHub App')}
                </LinkButton>
                <LinkButton
                  href="https://docs.sentry.io/product/builds/"
                  external
                  disabled
                  size="md"
                >
                  {t('View Documentation')}
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
