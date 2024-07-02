import {Fragment} from 'react';
import styled from '@emotion/styled';

import waitingForEventImg from 'sentry-images/spot/waiting-for-event.svg';

import ButtonBar from 'sentry/components/buttonBar';
import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import {OnboardingCodeSnippet} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';
import {TabbedCodeSnippet} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useSourcePackageRegistries} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import useLoadGettingStarted from 'sentry/components/onboarding/gettingStartedDoc/utils/useLoadGettingStarted';
import platforms from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PlatformIntegration, Project, ProjectKey} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {getPlatformPath} from 'sentry/utils/gettingStartedDocs/getPlatformPath';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import FirstEventIndicator from 'sentry/views/onboarding/components/firstEventIndicator';

export default function UpdatedEmptyState({project}: {project?: Project}) {
  const organization = useOrganization();

  const {
    data: projectKeys,
    isError: projectKeysIsError,
    isLoading: projectKeysIsLoading,
  } = useApiQuery<ProjectKey[]>(
    [`/projects/${organization.slug}/${project?.slug}/keys/`],
    {
      staleTime: Infinity,
      enabled: defined(project),
    }
  );

  const {isLoading: isLoadingRegistry, data: registryData} =
    useSourcePackageRegistries(organization);

  const currentPlatformKey = project?.platform ?? 'other';
  const currentPlatform = platforms.find(
    p => p.id === currentPlatformKey
  ) as PlatformIntegration;

  const platformPath = getPlatformPath(currentPlatform);

  const module = useLoadGettingStarted({
    platformId: currentPlatform.id,
    platformPath,
  });

  if (
    !project ||
    projectKeysIsError ||
    projectKeysIsLoading ||
    !projectKeys ||
    projectKeys.length === 0 ||
    !module ||
    !currentPlatform ||
    module === 'none'
  ) {
    return null;
  }

  const dsn = projectKeys[0].dsn.public;
  const {default: docs} = module;

  const docParams: DocsParams<any> = {
    cdn: projectKeys[0].dsn.cdn,
    dsn,
    organization,
    platformKey: currentPlatformKey,
    projectId: project.id,
    projectSlug: project.slug,
    isFeedbackSelected: false,
    isPerformanceSelected: true,
    isProfilingSelected: true,
    isReplaySelected: true,
    sourcePackageRegistries: {
      isLoading: isLoadingRegistry,
      data: registryData,
    },
    platformOptions: {installationMode: 'auto'},
    newOrg: false,
    replayOptions: {block: true, mask: true},
  };

  const install = docs.onboarding.install(docParams)[0];
  const configure = docs.onboarding.configure(docParams);
  const verify = docs.onboarding.verify(docParams);

  const {description: installDescription} = install;
  const {
    code,
    description: configDescription,
    language,
  } = install.configurations?.[0] ?? {};

  const {configurations, description: configureDescription} = configure[0] ?? {};
  const {configurations: sourceMapConfigurations, description: sourcemapDescription} =
    configure[1] ?? {};

  const {description: verifyDescription, configurations: verifyConfigutations} =
    verify[0] ?? {};

  return (
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
                  <DescriptionWrapper>{configDescription}</DescriptionWrapper>
                  <CodeSnippetWrapper>
                    {Array.isArray(code) ? (
                      <TabbedCodeSnippet tabs={code} />
                    ) : (
                      <OnboardingCodeSnippet language={language}>
                        {code ?? ''}
                      </OnboardingCodeSnippet>
                    )}
                  </CodeSnippetWrapper>
                  {verify.length === 0 && (
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
                <GuidedSteps.ButtonWrapper>
                  <GuidedSteps.BackButton size="md" />
                  <GuidedSteps.NextButton size="md" />
                </GuidedSteps.ButtonWrapper>
              </div>
            </GuidedSteps.Step>
            {configureDescription ? (
              <GuidedSteps.Step stepKey="configure-sentry" title={t('Configure Sentry')}>
                <div>
                  <div>
                    <DescriptionWrapper>{configureDescription}</DescriptionWrapper>
                    {configurations?.map((configuration, index) => (
                      <div key={index}>
                        <DescriptionWrapper>
                          {configuration.description}
                        </DescriptionWrapper>
                        <CodeSnippetWrapper>
                          {Array.isArray(configuration.code) ? (
                            <TabbedCodeSnippet tabs={configuration.code} />
                          ) : (
                            <OnboardingCodeSnippet language={configuration.language}>
                              {configuration.code ?? ''}
                            </OnboardingCodeSnippet>
                          )}
                        </CodeSnippetWrapper>
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
            {sourcemapDescription ? (
              <GuidedSteps.Step
                stepKey="sourcemaps-sentry"
                title={t('Upload Sourcemaps')}
              >
                <div>
                  <DescriptionWrapper>{sourcemapDescription}</DescriptionWrapper>
                  {sourceMapConfigurations?.map((configuration, index) => (
                    <div key={index}>
                      <DescriptionWrapper>{configuration.description}</DescriptionWrapper>
                      <CodeSnippetWrapper>
                        {Array.isArray(configuration.code) ? (
                          <TabbedCodeSnippet tabs={configuration.code} />
                        ) : (
                          <OnboardingCodeSnippet language={configuration.language}>
                            {configuration.code ?? ''}
                          </OnboardingCodeSnippet>
                        )}
                      </CodeSnippetWrapper>
                    </div>
                  ))}
                  <GuidedSteps.ButtonWrapper>
                    <GuidedSteps.BackButton size="md" />
                    <GuidedSteps.NextButton size="md" />
                  </GuidedSteps.ButtonWrapper>
                </div>
              </GuidedSteps.Step>
            ) : (
              <Fragment />
            )}
            {verifyDescription ? (
              <GuidedSteps.Step stepKey="verify-sentry" title={t('Verify')}>
                <div>
                  <DescriptionWrapper>{verifyDescription}</DescriptionWrapper>
                  {verifyConfigutations?.map((configuration, index) => (
                    <div key={index}>
                      <DescriptionWrapper>{configuration.description}</DescriptionWrapper>
                      <CodeSnippetWrapper>
                        {Array.isArray(configuration.code) ? (
                          <TabbedCodeSnippet tabs={configuration.code} />
                        ) : (
                          <OnboardingCodeSnippet language={configuration.language}>
                            {configuration.code ?? ''}
                          </OnboardingCodeSnippet>
                        )}
                      </CodeSnippetWrapper>
                    </div>
                  ))}
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
