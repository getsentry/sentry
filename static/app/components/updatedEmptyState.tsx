import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import waitingForEventImg from 'sentry-images/spot/waiting-for-event.svg';

import ButtonBar from 'sentry/components/buttonBar';
import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {OnboardingCodeSnippet} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';
import {TabbedCodeSnippet} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useSourcePackageRegistries} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import {useLoadGettingStarted} from 'sentry/components/onboarding/gettingStartedDoc/utils/useLoadGettingStarted';
import platforms from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {PlatformIntegration, Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import FirstEventIndicator from 'sentry/views/onboarding/components/firstEventIndicator';

export default function UpdatedEmptyState({project}: {project?: Project}) {
  const api = useApi();
  const organization = useOrganization();

  const {isPending: isLoadingRegistry, data: registryData} =
    useSourcePackageRegistries(organization);

  const {isSelfHosted, urlPrefix} = useLegacyStore(ConfigStore);

  const currentPlatformKey = project?.platform ?? 'other';
  const currentPlatform = platforms.find(
    p => p.id === currentPlatformKey
  ) as PlatformIntegration;

  useEffect(() => {
    trackAnalytics('issue_stream.updated_empty_state_viewed', {
      organization,
      platform: currentPlatformKey,
    });
  }, [organization, currentPlatformKey]);

  const loadGettingStarted = useLoadGettingStarted({
    platform: currentPlatform,
    orgSlug: organization.slug,
    projSlug: project?.slug,
  });

  if (
    !currentPlatform ||
    !project ||
    loadGettingStarted.isError ||
    loadGettingStarted.isLoading ||
    !loadGettingStarted.docs ||
    !loadGettingStarted.dsn ||
    !loadGettingStarted.projectKeyId
  ) {
    return null;
  }

  const docParams: DocsParams<any> = {
    api,
    projectKeyId: loadGettingStarted.projectKeyId,
    dsn: loadGettingStarted.dsn,
    organization,
    platformKey: currentPlatformKey,
    projectId: project.id,
    projectSlug: project.slug,
    isFeedbackSelected: false,
    isPerformanceSelected: false,
    isProfilingSelected: false,
    isReplaySelected: false,
    sourcePackageRegistries: {
      isLoading: isLoadingRegistry,
      data: registryData,
    },
    platformOptions: {installationMode: 'auto'},
    newOrg: false,
    replayOptions: {block: true, mask: true},
    isSelfHosted,
    urlPrefix,
  };

  if (currentPlatformKey === 'java' || currentPlatformKey === 'java-spring-boot') {
    docParams.platformOptions = {
      ...docParams.platformOptions,
      packageManager: 'gradle',
    };
  }

  const install = loadGettingStarted.docs.onboarding.install(docParams)[0]!;
  const configure = loadGettingStarted.docs.onboarding.configure(docParams);
  const verify = loadGettingStarted.docs.onboarding.verify(docParams);

  const {description: installDescription, additionalInfo: installInfo} = install;

  const installConfigurations = install.configurations ?? [];

  const {configurations, description: configureDescription} = configure[0] ?? {};
  const {
    configurations: extraConfigurations,
    description: extraConfigDescription,
    title: extraConfigTitle,
  } = configure[1] ?? {};

  const {description: verifyDescription, configurations: verifyConfigurations} =
    verify[0] ?? {};

  return (
    <AuthTokenGeneratorProvider projectSlug={project?.slug}>
      <div>
        <HeaderWrapper>
          <Title>{t('Get Started with Sentry Issues')}</Title>
          <Description>
            {t('Your code sleuth eagerly awaits its first mission.')}
          </Description>
          <Image src={waitingForEventImg} />
        </HeaderWrapper>
        <Divider />
        <Body>
          <Setup>
            <BodyTitle>{t('Set up the Sentry SDK')}</BodyTitle>
            <GuidedSteps>
              <GuidedSteps.Step stepKey="install-sentry" title={t('Install Sentry')}>
                <div>
                  <div>
                    <DescriptionWrapper>{installDescription}</DescriptionWrapper>
                    {installConfigurations.map((configuration, index) => (
                      <div key={index}>
                        <DescriptionWrapper>
                          {configuration.description}
                        </DescriptionWrapper>
                        <CodeSnippetWrapper>
                          {configuration.code ? (
                            Array.isArray(configuration.code) ? (
                              <TabbedCodeSnippet tabs={configuration.code} />
                            ) : (
                              <OnboardingCodeSnippet language={configuration.language}>
                                {configuration.code}
                              </OnboardingCodeSnippet>
                            )
                          ) : null}
                        </CodeSnippetWrapper>
                      </div>
                    ))}
                    <DescriptionWrapper>{installInfo}</DescriptionWrapper>
                    {!configurations &&
                      !extraConfigDescription &&
                      !verifyConfigurations && (
                        <FirstEventIndicator
                          organization={organization}
                          project={project}
                          eventType="error"
                        >
                          {({indicator, firstEventButton}) => (
                            <FirstEventWrapper>
                              <IndicatorWrapper>{indicator}</IndicatorWrapper>
                              <StyledButtonBar gap={1}>
                                <GuidedSteps.BackButton size="md" />
                                {firstEventButton}
                              </StyledButtonBar>
                            </FirstEventWrapper>
                          )}
                        </FirstEventIndicator>
                      )}
                  </div>
                  <GuidedSteps.ButtonWrapper>
                    <GuidedSteps.BackButton size="md" />
                    <GuidedSteps.NextButton size="md" />
                  </GuidedSteps.ButtonWrapper>
                </div>
              </GuidedSteps.Step>
              {configurations ? (
                <GuidedSteps.Step
                  stepKey="configure-sentry"
                  title={t('Configure Sentry')}
                >
                  <div>
                    <div>
                      <DescriptionWrapper>{configureDescription}</DescriptionWrapper>
                      {configurations.map((configuration, index) => (
                        <div key={index}>
                          <DescriptionWrapper>
                            {configuration.description}
                          </DescriptionWrapper>
                          <CodeSnippetWrapper>
                            {configuration.code ? (
                              Array.isArray(configuration.code) ? (
                                <TabbedCodeSnippet tabs={configuration.code} />
                              ) : (
                                <OnboardingCodeSnippet language={configuration.language}>
                                  {configuration.code}
                                </OnboardingCodeSnippet>
                              )
                            ) : null}
                          </CodeSnippetWrapper>
                          <CodeSnippetWrapper>
                            {configuration.configurations &&
                            configuration.configurations.length > 0 ? (
                              Array.isArray(configuration.configurations[0]!.code) ? (
                                <TabbedCodeSnippet
                                  tabs={configuration.configurations[0]!.code}
                                />
                              ) : null
                            ) : null}
                          </CodeSnippetWrapper>
                          <DescriptionWrapper>
                            {configuration.additionalInfo}
                          </DescriptionWrapper>
                        </div>
                      ))}
                    </div>
                    <GuidedSteps.ButtonWrapper>
                      <GuidedSteps.BackButton size="md" />
                      <GuidedSteps.NextButton size="md" />
                    </GuidedSteps.ButtonWrapper>
                  </div>
                </GuidedSteps.Step>
              ) : (
                <Fragment />
              )}
              {extraConfigDescription ? (
                <GuidedSteps.Step
                  stepKey="extra-configuration-sentry"
                  title={extraConfigTitle || t('Upload Source Maps')}
                >
                  <div>
                    <div>
                      <DescriptionWrapper>{extraConfigDescription}</DescriptionWrapper>
                      {extraConfigurations?.map((configuration, index) => (
                        <div key={index}>
                          <DescriptionWrapper>
                            {configuration.description}
                          </DescriptionWrapper>
                          <CodeSnippetWrapper>
                            {configuration.code ? (
                              Array.isArray(configuration.code) ? (
                                <TabbedCodeSnippet tabs={configuration.code} />
                              ) : (
                                <OnboardingCodeSnippet language={configuration.language}>
                                  {configuration.code}
                                </OnboardingCodeSnippet>
                              )
                            ) : null}
                          </CodeSnippetWrapper>
                        </div>
                      ))}
                      {!verifyConfigurations && !verifyDescription && (
                        <FirstEventIndicator
                          organization={organization}
                          project={project}
                          eventType="error"
                        >
                          {({indicator, firstEventButton}) => (
                            <div>
                              <IndicatorWrapper>{indicator}</IndicatorWrapper>
                              <StyledButtonBar gap={1}>
                                <GuidedSteps.BackButton size="md" />
                                {firstEventButton}
                              </StyledButtonBar>
                            </div>
                          )}
                        </FirstEventIndicator>
                      )}
                    </div>
                    {(verifyConfigurations || verifyDescription) && (
                      <GuidedSteps.ButtonWrapper>
                        <GuidedSteps.BackButton size="md" />
                        <GuidedSteps.NextButton size="md" />
                      </GuidedSteps.ButtonWrapper>
                    )}
                  </div>
                </GuidedSteps.Step>
              ) : (
                <Fragment />
              )}
              {verifyConfigurations || verifyDescription ? (
                <GuidedSteps.Step stepKey="verify-sentry" title={t('Verify')}>
                  <div>
                    <DescriptionWrapper>{verifyDescription}</DescriptionWrapper>
                    {verifyConfigurations?.map((configuration, index) => (
                      <div key={index}>
                        <DescriptionWrapper>
                          {configuration.description}
                        </DescriptionWrapper>
                        <CodeSnippetWrapper>
                          {configuration.code ? (
                            Array.isArray(configuration.code) ? (
                              <TabbedCodeSnippet tabs={configuration.code} />
                            ) : (
                              <OnboardingCodeSnippet language={configuration.language}>
                                {configuration.code}
                              </OnboardingCodeSnippet>
                            )
                          ) : null}
                        </CodeSnippetWrapper>
                      </div>
                    ))}
                    <FirstEventIndicator
                      organization={organization}
                      project={project}
                      eventType="error"
                    >
                      {({indicator, firstEventButton}) => (
                        <FirstEventWrapper>
                          <IndicatorWrapper>{indicator}</IndicatorWrapper>
                          <StyledButtonBar gap={1}>
                            <GuidedSteps.BackButton size="md" />
                            {firstEventButton}
                          </StyledButtonBar>
                        </FirstEventWrapper>
                      )}
                    </FirstEventIndicator>
                  </div>
                </GuidedSteps.Step>
              ) : (
                <Fragment />
              )}
            </GuidedSteps>
          </Setup>
          <Preview>
            <BodyTitle>{t('Preview a Sentry Issue')}</BodyTitle>
            <ArcadeWrapper>
              <Arcade
                src="https://demo.arcade.software/54VidzNthU5ykIFPCdW1?embed"
                loading="lazy"
                allowFullScreen
              />
            </ArcadeWrapper>
          </Preview>
        </Body>
      </div>
    </AuthTokenGeneratorProvider>
  );
}

const Title = styled('div')`
  font-size: 26px;
  font-weight: ${p => p.theme.fontWeightBold};
`;

const Description = styled('div')`
  max-width: 340px;
`;

const ArcadeWrapper = styled('div')`
  margin-top: ${space(1)};
`;

const HeaderWrapper = styled('div')`
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(4)};
`;

const BodyTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  margin-bottom: ${space(1)};
`;

const Setup = styled('div')`
  padding: ${space(4)};

  &:after {
    content: '';
    position: absolute;
    right: 50%;
    top: 19%;
    height: 78%;
    border-right: 1px ${p => p.theme.border} solid;
  }
`;

const Preview = styled('div')`
  padding: ${space(4)};
`;

const Body = styled('div')`
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;

  h4 {
    margin-bottom: 0;
  }
`;

const Image = styled('img')`
  position: absolute;
  display: block;
  top: 0px;
  right: 20px;
  pointer-events: none;
  height: 120px;
  overflow: hidden;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
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
  height: 500px;
  border: 0;
`;

const StyledButtonBar = styled(ButtonBar)`
  display: flex;
`;

const IndicatorWrapper = styled('div')`
  width: 300px;
  max-width: 100%;
  margin-bottom: ${space(1)};
`;

const CodeSnippetWrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

const DescriptionWrapper = styled('div')`
  margin-bottom: ${space(1)};
`;

const FirstEventWrapper = styled('div')`
  padding-top: ${space(1)};
`;
