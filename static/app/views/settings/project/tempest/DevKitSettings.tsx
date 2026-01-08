import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import waitingForEventImg from 'sentry-images/spot/waiting-for-event.svg';
import devkitCrashesStep1 from 'sentry-images/tempest/devkit-crashes-step1.png';
import devkitCrashesStep2 from 'sentry-images/tempest/devkit-crashes-step2.png';
import devkitCrashesStep3 from 'sentry-images/tempest/devkit-crashes-step3.png';
import devkitCrashesStep4 from 'sentry-images/tempest/devkit-crashes-step4.jpg';
import devkitCrashesStep5 from 'sentry-images/tempest/devkit-crashes-step5.jpg';
import windowToolImg from 'sentry-images/tempest/windows-tool-devkit.png';

import Accordion from 'sentry/components/container/accordion';
import {Button} from 'sentry/components/core/button';
import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {OnboardingCodeSnippet} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {decodeInteger} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useProjectKeys} from 'sentry/utils/useProjectKeys';

interface Props {
  organization: Organization;
  project: Project;
}

export default function DevKitSettings({organization, project}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedAccordionIndex, setExpandedAccordionIndex] = useState<number>(-1);

  const {data: projectKeys, isPending: isLoadingKeys} = useProjectKeys({
    orgSlug: organization.slug,
    projSlug: project.slug,
  });

  if (isLoadingKeys) {
    return <LoadingIndicator />;
  }

  return (
    <Fragment>
      <Panel>
        <PanelBody>
          <div>
            <HeaderWrapper>
              <Title>{t('Get Started with DevKit Crash Monitoring')}</Title>
              <Description>
                {t(
                  'Set up your PlayStation development kit to send crash reports to Sentry.'
                )}
              </Description>
              <Image src={waitingForEventImg} />
            </HeaderWrapper>
            <Divider />
            <Body>
              <Setup>
                <BodyTitle>{t('Setup Instructions')}</BodyTitle>
                <GuidedSteps
                  initialStep={decodeInteger(location.query.guidedStep)}
                  onStepChange={step => {
                    navigate({
                      pathname: location.pathname,
                      query: {
                        ...location.query,
                        guidedStep: step,
                      },
                    });
                  }}
                >
                  <GuidedSteps.Step
                    stepKey="step-1"
                    title={t('Copy PlayStation Ingestion URL')}
                  >
                    <DescriptionWrapper>
                      <p>
                        {t(
                          'This is the URL that the DevKit will use to communicate with Sentry.'
                        )}
                      </p>
                      <CodeSnippetWrapper>
                        <OnboardingCodeSnippet>
                          {projectKeys?.[0]?.dsn?.playstation || ''}
                        </OnboardingCodeSnippet>
                      </CodeSnippetWrapper>
                    </DescriptionWrapper>
                    <GuidedSteps.StepButtons />
                  </GuidedSteps.Step>

                  <GuidedSteps.Step stepKey="step-2" title={t('Configure URL')}>
                    <DescriptionWrapper>
                      <IntroText>
                        {t(
                          'There are two ways to configure the URL on your DevKit. Choose one of the following methods:'
                        )}
                      </IntroText>

                      <Accordion
                        expandedIndex={expandedAccordionIndex}
                        setExpandedIndex={setExpandedAccordionIndex}
                        items={[
                          {
                            header: (
                              <AccordionHeader>
                                {t('Using the Windows tool to set the URL')}
                              </AccordionHeader>
                            ),
                            content: (
                              <AccordionContentWrapper>
                                <StepContentColumn>
                                  <StepTextSection>
                                    <p>
                                      {t(
                                        `Using the Windows tool enter the URL as the 'Request Check URL' and 'Upload URL'.`
                                      )}
                                    </p>
                                  </StepTextSection>
                                  <StepImageSection>
                                    <CardIllustration
                                      src={windowToolImg}
                                      alt="Setup Configuration"
                                    />
                                  </StepImageSection>
                                </StepContentColumn>
                              </AccordionContentWrapper>
                            ),
                          },
                          {
                            header: (
                              <AccordionHeader>
                                {t('Using the DevKit Directly to set the URL')}
                              </AccordionHeader>
                            ),
                            content: (
                              <AccordionContentWrapper>
                                <StepContentColumn>
                                  <StepTextSection>
                                    <p>
                                      {t(
                                        `If you haven't done it via the Windows tool, you can set up the 'Upload URL' and 'Request Check URL' directly in the DevKit. This can be done under 'Debug Settings' > 'Core Dump' > 'Upload' > 'Upload URL' and 'Debug Settings' > 'Core Dump' > 'Data Request' > 'Request Check URL' respectively.`
                                      )}
                                    </p>
                                  </StepTextSection>
                                  <StepImageSection>
                                    <CardIllustration
                                      src={devkitCrashesStep1}
                                      alt="Setup Configuration"
                                    />
                                  </StepImageSection>
                                  <StepImageSection>
                                    <CardIllustration
                                      src={devkitCrashesStep2}
                                      alt="Setup Configuration"
                                    />
                                  </StepImageSection>
                                  <StepImageSection>
                                    <CardIllustration
                                      src={devkitCrashesStep3}
                                      alt="Setup Configuration"
                                    />
                                  </StepImageSection>
                                  <StepImageSection>
                                    <CardIllustration
                                      src={devkitCrashesStep4}
                                      alt="Setup Configuration"
                                    />
                                  </StepImageSection>
                                  <StepImageSection>
                                    <CardIllustration
                                      src={devkitCrashesStep5}
                                      alt="Setup Configuration"
                                    />
                                  </StepImageSection>
                                </StepContentColumn>
                              </AccordionContentWrapper>
                            ),
                          },
                        ]}
                      />
                    </DescriptionWrapper>
                    <GuidedSteps.StepButtons />
                  </GuidedSteps.Step>

                  <GuidedSteps.Step stepKey="step-3" title={t('Important Notes')}>
                    <DescriptionWrapper>
                      <p>
                        {t(
                          'If you are trying to re-attempt the upload of a failed crash that occurred before entering the URL it might be that the DevKit still tries to send the crash to the previously specified URL.'
                        )}
                      </p>

                      <p>
                        {t(
                          'There is currently a limit on the size of files we support, as such, uploading large dumps or long videos may fail. During the first setup it is recommended to not send any videos, and once you made sure everything works, you can start sending larger attachments.'
                        )}
                      </p>
                    </DescriptionWrapper>
                    <GuidedSteps.StepButtons>
                      <Button
                        size="sm"
                        priority="primary"
                        onClick={() => {
                          navigate({
                            pathname: '/issues/',
                            query: {
                              query: 'os.name:PlayStation',
                            },
                          });
                        }}
                      >
                        {t('View DevKit Issues')}
                      </Button>
                    </GuidedSteps.StepButtons>
                  </GuidedSteps.Step>
                </GuidedSteps>
              </Setup>
            </Body>
          </div>
        </PanelBody>
      </Panel>
    </Fragment>
  );
}

const Title = styled('div')`
  font-size: 26px;
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const Description = styled('div')``;

const HeaderWrapper = styled('div')`
  border-radius: ${p => p.theme.radius.md};
  padding: ${space(4)};
`;

const BodyTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin-bottom: ${space(1)};
`;

const Setup = styled('div')`
  padding: ${space(4)};
`;

const Body = styled('div')``;

const Image = styled('img')`
  position: absolute;
  display: block;
  top: 0px;
  right: 20px;
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
  background: ${p => p.theme.tokens.border.primary};
  border: none;
  margin-top: 0;
  margin-bottom: 0;
`;

const CodeSnippetWrapper = styled('div')`
  margin-bottom: ${space(2)};
  margin-top: ${space(2)};
`;

const DescriptionWrapper = styled('div')`
  margin-bottom: ${space(1)};
`;

const StepContentColumn = styled('div')`
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: ${space(3)};
`;

const StepTextSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const StepImageSection = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
`;

const CardIllustration = styled('img')`
  width: 100%;
  max-width: 600px;
  height: auto;
  object-fit: contain;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  box-shadow: ${p => p.theme.dropShadowLight};
`;

const IntroText = styled('p')`
  margin-bottom: ${space(2)};
`;

const AccordionHeader = styled('span')`
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const AccordionContentWrapper = styled('div')`
  padding: ${space(2)};
`;
