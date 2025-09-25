import {useState} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import emptyBuildImg from 'sentry-images/spot/releases-tour-commits.svg';

import {Alert} from 'sentry/components/core/alert';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {TabList, Tabs} from 'sentry/components/core/tabs';
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
    <MethodContent>
      {!isIOS && (
        <Alert type="info" showIcon>
          {t('Fastlane is for iOS applications only')}
        </Alert>
      )}
      <div>
        <StepDescription>Add to your fastlane/Pluginfile:</StepDescription>
        <OnboardingCodeSnippet language="ruby">
          {`gem 'fastlane-plugin-sentry', git: 'https://github.com/getsentry/sentry-fastlane-plugin.git', ref: 'b0c36a1472a6bfde0a4766c612c1154706dbd014'`}
        </OnboardingCodeSnippet>
      </div>

      <div>
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
      </div>

      <div>
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
      </div>
    </MethodContent>
  );
}

function GradleMethod({projectPlatform}: {projectPlatform: PlatformKey | null}) {
  const isAndroid = projectPlatform?.includes('android');

  return (
    <MethodContent>
      {!isAndroid && (
        <Alert type="info" showIcon>
          {t('Gradle Plugin is for Android applications only')}
        </Alert>
      )}
      <div>
        <StepDescription>Apply the plugin (use version 6.0.0-alpha.3):</StepDescription>
        <OnboardingCodeSnippet language="kotlin">
          {`plugins {
  id "io.sentry.android.gradle" version "6.0.0-alpha.3"
}`}
        </OnboardingCodeSnippet>
      </div>

      <div>
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
      </div>

      <div>
        <StepDescription>Set environment variables in GitHub Actions:</StepDescription>
        <OnboardingCodeSnippet language="yaml">
          {`env:
  SENTRY_AUTH_TOKEN: \${{ secrets.SENTRY_AUTH_TOKEN }}
  GITHUB_BASE_SHA: \${{ github.event.pull_request.base.sha }}
  SENTRY_SHA: \${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}`}
        </OnboardingCodeSnippet>
      </div>
    </MethodContent>
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
    <MethodContent>
      <div>
        <StepDescription>
          {tct('Install the [link:Sentry CLI]', {
            link: (
              <a
                href="https://docs.sentry.io/cli/installation/"
                target="_blank"
                rel="noreferrer"
              />
            ),
          })}
        </StepDescription>
        <OnboardingCodeSnippet language="bash">
          {`# Using npm
npm install -g @sentry/cli

# Using curl
curl -sL https://sentry.io/get-cli/ | bash`}
        </OnboardingCodeSnippet>
      </div>

      <div>
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
      </div>

      <div>
        <StepDescription>Set these environment variables in your CI:</StepDescription>
        <OnboardingCodeSnippet language="bash">
          {`export SENTRY_AUTH_TOKEN=<your-auth-token>
# These are set automatically in GitHub Actions:
# --repo-name, --vcs-provider, --pr-number`}
        </OnboardingCodeSnippet>
      </div>
    </MethodContent>
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
                <TabsWrapper>
                  <Tabs value={selectedMethod} onChange={setSelectedMethod}>
                    <TabList>
                      {availableMethods.map(method => (
                        <TabList.Item key={method.value} textValue={method.label}>
                          {method.label}
                        </TabList.Item>
                      ))}
                    </TabList>
                  </Tabs>
                </TabsWrapper>
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
  margin-bottom: ${p => p.theme.space.md};
`;

const Title = styled('div')`
  font-size: 26px;
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const BulletList = styled('ul')`
  list-style-type: disc;
  padding-left: 20px;
  margin-bottom: ${p => p.theme.space.xl};

  li {
    margin-bottom: ${p => p.theme.space.md};
  }
`;

const HeaderWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${p => p.theme.space['2xl']};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${p => p.theme.space['3xl']};
`;

const HeaderText = styled('div')`
  flex: 0.65;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    flex: 1;
  }
`;

const Setup = styled('div')`
  padding: ${p => p.theme.space['3xl']};
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
  margin-bottom: ${p => p.theme.space['2xl']};
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled('h3')`
  font-size: 18px;
  font-weight: 600;
  margin-bottom: ${p => p.theme.space.xl};
  color: ${p => p.theme.textColor};
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
`;

const Description = styled('p')`
  margin-bottom: ${p => p.theme.space.xl};
  color: ${p => p.theme.subText};
  line-height: 1.5;
`;

const MethodContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space['2xl']};
`;

const TabsWrapper = styled('div')`
  margin-bottom: ${p => p.theme.space['2xl']};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const StepDescription = styled('p')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};
`;

const ActionsContainer = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.xl};
  flex-wrap: wrap;
`;
