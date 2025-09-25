import {useState} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import emptyBuildImg from 'sentry-images/spot/releases-tour-commits.svg';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {OnboardingCodeSnippet} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PlatformKey} from 'sentry/types/project';

interface PreprodOnboardingProps {
  organizationSlug: string;
  projectPlatform: PlatformKey | null;
  projectSlug: string;
}

type UploadMethod = 'fastlane' | 'gradle' | 'cli';

function FastlaneMethod({
  organizationSlug,
  projectSlug,
}: {
  organizationSlug: string;
  projectSlug: string;
}) {
  return (
    <div>
      <StepContainer>
        <StepDescription>Add to your fastlane/Pluginfile:</StepDescription>
        <OnboardingCodeSnippet language="ruby">
          {`gem 'fastlane-plugin-sentry', git: 'https://github.com/getsentry/sentry-fastlane-plugin.git', ref: 'b0c36a1472a6bfde0a4766c612c1154706dbd014'`}
        </OnboardingCodeSnippet>
      </StepContainer>

      <StepContainer>
        <StepDescription>Add a lane to your Fastfile:</StepDescription>
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
      </StepContainer>

      <StepContainer>
        <StepDescription>
          Set environment variables in your GitHub Action:
        </StepDescription>
        <OnboardingCodeSnippet language="yaml">
          {`env:
  SENTRY_AUTH_TOKEN: \${{ secrets.SENTRY_AUTH_TOKEN }}
  SENTRY_CONFIGURATION: Release
  GITHUB_BASE_SHA: \${{ github.event.pull_request.base.sha }}
  SENTRY_SHA: \${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}`}
        </OnboardingCodeSnippet>
      </StepContainer>
    </div>
  );
}

function GradleMethod() {
  return (
    <div>
      <StepContainer>
        <StepDescription>Apply the plugin (use version 6.0.0-alpha.3):</StepDescription>
        <OnboardingCodeSnippet language="kotlin">
          {`plugins {
  id "io.sentry.android.gradle" version "6.0.0-alpha.3"
}`}
        </OnboardingCodeSnippet>
      </StepContainer>

      <StepContainer>
        <StepDescription>Configure the plugin:</StepDescription>
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
      </StepContainer>

      <StepContainer>
        <StepDescription>Set environment variables in GitHub Actions:</StepDescription>
        <OnboardingCodeSnippet language="yaml">
          {`env:
  SENTRY_AUTH_TOKEN: \${{ secrets.SENTRY_AUTH_TOKEN }}
  GITHUB_BASE_SHA: \${{ github.event.pull_request.base.sha }}
  SENTRY_SHA: \${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}`}
        </OnboardingCodeSnippet>
      </StepContainer>
    </div>
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
    <div>
      <StepContainer>
        <StepDescription>Install the Sentry CLI tool:</StepDescription>
        <OnboardingCodeSnippet language="bash">
          {`# Using npm
npm install -g @sentry/cli

# Using curl
curl -sL https://sentry.io/get-cli/ | bash`}
        </OnboardingCodeSnippet>
      </StepContainer>

      <StepContainer>
        <StepDescription>Upload your build using the CLI:</StepDescription>
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
      </StepContainer>

      <StepContainer>
        <StepDescription>Set these environment variables in your CI:</StepDescription>
        <OnboardingCodeSnippet language="bash">
          {`export SENTRY_AUTH_TOKEN=<your-auth-token>
# These are set automatically in GitHub Actions:
# --repo-name, --vcs-provider, --pr-number`}
        </OnboardingCodeSnippet>
      </StepContainer>
    </div>
  );
}

export function PreprodOnboarding({
  organizationSlug,
  projectPlatform,
  projectSlug,
}: PreprodOnboardingProps) {
  const isIOS = projectPlatform?.includes('apple') || projectPlatform?.includes('ios');
  const isAndroid = projectPlatform?.includes('android');

  let availableMethods: Array<{label: string; value: UploadMethod}>;
  let defaultMethod: UploadMethod;

  if (isIOS) {
    availableMethods = [
      {label: 'Fastlane', value: 'fastlane'},
      {label: 'Sentry CLI', value: 'cli'},
    ];
    defaultMethod = 'fastlane';
  } else if (isAndroid) {
    availableMethods = [
      {label: 'Gradle Plugin', value: 'gradle'},
      {label: 'Sentry CLI', value: 'cli'},
    ];
    defaultMethod = 'gradle';
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
          <FastlaneMethod organizationSlug={organizationSlug} projectSlug={projectSlug} />
        );
      case 'gradle':
        return <GradleMethod />;
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
        <div>
          <HeaderWrapper>
            <HeaderText>
              <Title>{t('Upload Builds to Sentry')}</Title>
              <SubTitle>
                {t('Monitor & reduce your app size and distribute pre-release builds')}
              </SubTitle>
              <BulletList>
                <li>{t('Get automated checks and PR comments for size regressions')}</li>
                <li>
                  {t('See actionable insights on what can be removed or optimized')}
                </li>
                <li>{t('Track app size trends over time across releases')}</li>
              </BulletList>
            </HeaderText>
            <Image src={emptyBuildImg} />
          </HeaderWrapper>
          <Divider />
          <Body>
            <Setup>
              <Section>
                <SectionTitle>Prerequisites</SectionTitle>
                <Description>
                  {tct(
                    'You need a Sentry Auth Token to upload builds. [link:Generate one here] and set it as [code:SENTRY_AUTH_TOKEN] in your environment.',
                    {
                      link: (
                        <a
                          href={`/settings/${organizationSlug}/auth-tokens/`}
                          target="_blank"
                          rel="noreferrer"
                        />
                      ),
                      code: <code />,
                    }
                  )}
                </Description>
              </Section>

              <Section>
                <SectionTitle>
                  {projectPlatform && <PlatformIcon platform={projectPlatform} />}
                  Uploading Builds
                </SectionTitle>
                <TabsContainer>
                  {availableMethods.map(method => (
                    <Tab
                      key={method.value}
                      active={selectedMethod === method.value}
                      onClick={() => setSelectedMethod(method.value)}
                    >
                      {method.label}
                    </Tab>
                  ))}
                </TabsContainer>

                {renderMethodContent()}
              </Section>

              {/* Next Steps */}
              <Section>
                <SectionTitle>Integrating into CI</SectionTitle>
                <Description>
                  {tct(
                    'Integrating the GitHub App is required for PR annotations and workflow automation. [link:Install the GitHub App →]',
                    {
                      link: (
                        <a
                          href="https://docs.sentry.io/organization/integrations/source-code-mgmt/github/"
                          target="_blank"
                          rel="noreferrer"
                        />
                      ),
                    }
                  )}
                </Description>

                <ActionsContainer>
                  <LinkButton
                    priority="primary"
                    href="https://docs.sentry.io/organization/integrations/source-code-mgmt/github/"
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
                </ActionsContainer>
              </Section>
            </Setup>
          </Body>
        </div>
      </PanelBody>
    </Panel>
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

const BodyTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin-bottom: ${space(1)};
`;

const Setup = styled('div')`
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

const Section = styled('section')`
  margin-bottom: ${space(3)};
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled('h3')`
  font-size: 18px;
  font-weight: 600;
  margin-bottom: ${space(2)};
  color: ${p => p.theme.textColor};
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
`;

const Description = styled('p')`
  margin-bottom: ${space(2)};
  color: ${p => p.theme.subText};
  line-height: 1.5;
`;

const TabsContainer = styled('div')`
  display: flex;
  border-bottom: 1px solid ${p => p.theme.border};
  margin-bottom: ${space(2)};
  gap: ${space(2)};
`;

const Tab = styled('button')<{active: boolean}>`
  padding: ${space(1)} ${space(2)};
  background: none;
  border: none;
  border-bottom: 2px solid ${p => (p.active ? p.theme.active : 'transparent')};
  color: ${p => (p.active ? p.theme.textColor : p.theme.subText)};
  cursor: pointer;
  font-size: 14px;
  font-weight: ${p => (p.active ? 600 : 400)};
  transition: all 0.2s ease;

  &:hover {
    color: ${p => p.theme.textColor};
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const StepContainer = styled('div')`
  margin-bottom: ${space(3)};
`;

const StepDescription = styled('p')`
  margin-bottom: ${space(1)};
  color: ${p => p.theme.subText};
  font-size: 14px;
`;

const ActionsContainer = styled('div')`
  display: flex;
  gap: ${space(2)};
  flex-wrap: wrap;
`;
