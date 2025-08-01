import {Fragment} from 'react';
import styled from '@emotion/styled';

import preventAiComment1 from 'sentry-images/codecov/prevent-ai-comment-1.png';
import preventAiComment2 from 'sentry-images/codecov/prevent-ai-comment-2.png';
import preventAiIllustration from 'sentry-images/features/preventai.svg';

import {ExternalLink} from 'sentry/components/core/link';
import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export default function AIPage() {
  return (
    <Fragment>
      <OnboardingPanel>
        <Container>
          <ImageColumn>
            <IllustrationImage
              src={preventAiIllustration}
              alt="Prevent AI illustration"
            />
          </ImageColumn>
          <TextColumn>
            <Title>{t('Ship Code That Breaks Less With Code Reviews And Tests')}</Title>
            <Description>
              {t('Prevent AI is a generative AI agent that automates tasks in your PR:')}
            </Description>
            <ul>
              <li>
                {t(
                  'It reviews your pull request, predicting errors and suggesting code fixes.'
                )}
              </li>
              <li>{t('It generates unit tests for untested code in your PR.')}</li>
            </ul>
            {/* <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/sentry-prevent-ai/">
              {t('Learn more')}
            </ExternalLink> */}
          </TextColumn>
        </Container>
      </OnboardingPanel>

      <SetupGuidePanel>
        <SetupContainer>
          <SetupContentWrapper>
            <SetupContent>
              <SetupHeader>
                <SetupTitle>{t('Set up Prevent AI')}</SetupTitle>
                <SetupDescription>
                  {t(
                    "These setups must be installed or approved by an admin. If you're not an admin, reach out to your organization's admins to ensure they approve the installation."
                  )}
                </SetupDescription>
              </SetupHeader>

              <Divider />

              <StepsContainer>
                <StepLine />
                <StepsContent>
                  <Step>
                    <StepNumber>
                      <StepCircle>1</StepCircle>
                    </StepNumber>
                    <StepContent>
                      <StepTitle>{t('Enable Generative AI features')}</StepTitle>
                      <StepDescription>
                        {t('Make sure AI features are enabled in your ')}{' '}
                        <ExternalLink href="https://sentry.io/settings/organization/">
                          {t('organization settings')}
                        </ExternalLink>
                        .
                      </StepDescription>
                    </StepContent>
                  </Step>

                  <Step>
                    <StepNumber>
                      <StepCircle>2</StepCircle>
                    </StepNumber>
                    <StepContent>
                      <StepTitle>{t('Set Up GitHub Integration')}</StepTitle>
                      <StepDescription>
                        {t('To grant Seer access to your codebase, follow these ')}{' '}
                        <ExternalLink href="https://docs.sentry.io/product/integrations/source-code-mgmt/github/">
                          {t('GitHub integration instructions')}
                        </ExternalLink>
                        :{' '}
                        {t(
                          '1. Install the Sentry GitHub app. 2. Connect your GitHub repositories.'
                        )}
                      </StepDescription>
                    </StepContent>
                  </Step>

                  <Step>
                    <StepNumber>
                      <StepCircle>3</StepCircle>
                    </StepNumber>
                    <StepContent>
                      <StepTitle>{t('Set Up Seer')}</StepTitle>
                      <StepDescription>
                        {t('Install the ')}{' '}
                        <ExternalLink href="https://github.com/apps/seer-by-sentry">
                          {t('Seer by Sentry GitHub App')}
                        </ExternalLink>{' '}
                        {t('and ')}{' '}
                        <ExternalLink href="https://codecov.sentry.io/settings/projects/api/seer/">
                          {t('add repositories')}
                        </ExternalLink>{' '}
                        {t('within the same GitHub organization.')}
                      </StepDescription>
                    </StepContent>
                  </Step>
                </StepsContent>
              </StepsContainer>

              <InfoBox>
                <InfoContent>
                  <InfoTitle>{t('How to use Prevent AI')}</InfoTitle>
                  <InfoDescription>
                    {t('Prevent AI helps you ship better code with three features:')}
                  </InfoDescription>
                  <InfoList>
                    <InfoListItem>
                      {t(
                        'It reviews your code, suggesting broader fixes when you prompt '
                      )}{' '}
                      <PurpleText>@sentry review</PurpleText>.
                    </InfoListItem>
                    <InfoListItem>
                      {t(
                        'It predicts which errors your code will cause. This happens automatically on every commit, when you mark a PR ready for review, and when you trigger a PR review with '
                      )}{' '}
                      <PurpleText>@sentry review</PurpleText>.
                    </InfoListItem>
                    <InfoListItem>
                      {t('It generates unit tests for your PR when you prompt ')}{' '}
                      <PurpleText>@sentry generate-test</PurpleText>.
                    </InfoListItem>
                  </InfoList>
                  <InfoNote>
                    {t(
                      'Sentry Error Prediction works better with Sentry Issue Context. '
                    )}{' '}
                    <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/sentry-prevent-ai/">
                      {t('Learn more')}
                    </ExternalLink>{' '}
                    {t(
                      'on how to set this up to get the most accurate error prediction we can offer.'
                    )}
                  </InfoNote>
                </InfoContent>
              </InfoBox>
            </SetupContent>

            <SetupImageColumn>
              <PreventAiImage
                src={preventAiComment1}
                alt="Prevent AI PR comment example 1"
              />
              <PreventAiImage
                src={preventAiComment2}
                alt="Prevent AI PR comment example 2"
              />
            </SetupImageColumn>
          </SetupContentWrapper>
        </SetupContainer>

        <DisclaimerText>
          <IconInfo size="xs" color="subText" />
          {t('This page will remain visible after the app is installed.')}
        </DisclaimerText>
      </SetupGuidePanel>
    </Fragment>
  );
}

const OnboardingPanel = styled('div')`
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  margin-bottom: ${space(2)};
  position: relative;
`;

const Container = styled('div')`
  padding: ${space(3)};
  position: relative;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    display: flex;
    align-items: center;
    flex-direction: row;
    justify-content: center;
    flex-wrap: wrap;
    min-height: 300px;
    max-width: 1000px;
    margin: 0 auto;
  }

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    min-height: 250px;
  }
`;

const ImageColumn = styled('div')`
  position: relative;
  min-height: 100px;
  max-width: 300px;
  min-width: 150px;
  margin: ${space(2)} auto;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    flex: 1;
    margin: ${space(3)};
    max-width: auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

const TextColumn = styled('div')`
  min-width: 0;
  z-index: 1;
  max-width: 600px;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    flex: 2;
  }
`;

const IllustrationImage = styled('img')`
  width: 227px;
  height: 157px;
  object-fit: contain;
  max-width: 100%;
`;

const Title = styled('h3')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: 26px;
  line-height: 1.25;
  color: ${p => p.theme.headingColor};
  margin: 0 0 ${space(0.5)} 0;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    font-size: ${p => p.theme.fontSize.xl};
    text-align: center;
  }
`;

const Description = styled('p')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.43;
  color: ${p => p.theme.textColor};
  margin: 0 0 ${space(1)} 0;
`;

const SetupGuidePanel = styled('div')`
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  margin-bottom: ${space(2)};
  position: relative;
`;

const SetupContainer = styled('div')`
  padding: ${space(3)} ${space(4)};
  max-width: 1230px;
  margin: 0 auto;
`;

const SetupHeader = styled('div')`
  margin-bottom: ${space(3)};
`;

const SetupTitle = styled('h3')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: 26px;
  line-height: 1.54;
  color: ${p => p.theme.headingColor};
  margin: 0 0 ${space(0.5)} 0;
`;

const SetupDescription = styled('p')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.43;
  color: ${p => p.theme.headingColor};
  margin: 0;
  max-width: 621px;
`;

const Divider = styled('div')`
  height: 1px;
  background: ${p => p.theme.border};
  margin: ${space(3)} 0;
`;

const StepsContainer = styled('div')`
  position: relative;
  margin-bottom: ${space(3)};
`;

const StepLine = styled('div')`
  position: absolute;
  left: 13px;
  top: 26px;
  bottom: 26px;
  width: 0;
  border-left: 1px solid ${p => p.theme.border};
  z-index: 1;
`;

const StepsContent = styled('div')`
  margin-left: ${space(4)};
`;

const Step = styled('div')`
  display: flex;
  align-items: flex-start;
  margin-bottom: ${space(4)};
  position: relative;

  &:last-child {
    margin-bottom: 0;
  }
`;

const StepNumber = styled('div')`
  position: absolute;
  left: -${space(4)};
  top: ${space(0.5)};
  z-index: 2;
`;

const StepCircle = styled('div')`
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: ${p => p.theme.purple300};
  color: ${p => p.theme.white};
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.19;
`;

const StepContent = styled('div')`
  flex: 1;
`;

const StepTitle = styled('h4')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: 18px;
  line-height: 1.72;
  letter-spacing: -0.31px;
  color: ${p => p.theme.textColor};
  margin: 0 0 ${space(0.5)} 0;
`;

const StepDescription = styled('p')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.25;
  color: ${p => p.theme.subText};
  margin: 0;
`;

const InfoBox = styled('div')`
  background: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.translucentBorder};
  border-radius: 8px;
  padding: ${space(3)} ${space(3)};
  margin-bottom: ${space(3)};
  max-width: 657px;
`;

const InfoContent = styled('div')`
  max-width: 610px;
`;

const InfoTitle = styled('h4')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.5;
  color: ${p => p.theme.textColor};
  margin: 0 0 ${space(1)} 0;
`;

const InfoDescription = styled('p')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.5;
  color: ${p => p.theme.textColor};
  margin: 0 0 ${space(1)} 0;
`;

const InfoList = styled('ul')`
  margin: 0 0 ${space(2)} 0;
  padding-left: ${space(2)};
`;

const InfoListItem = styled('li')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1.5;
  color: ${p => p.theme.textColor};
  margin-bottom: ${space(0.5)};

  &:last-child {
    margin-bottom: 0;
  }
`;

const InfoNote = styled('p')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1.5;
  color: ${p => p.theme.subText};
  margin: 0;
`;

const DisclaimerText = styled('div')`
  padding: 0 ${space(4)} ${space(3)};
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1.67;
  color: ${p => p.theme.subText};
  text-align: left;
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const SetupContentWrapper = styled('div')`
  display: flex;
  gap: ${space(3)};
  align-items: flex-start;

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    flex-direction: column;
  }
`;

const SetupContent = styled('div')`
  flex: 1.5;
  min-width: 0;
`;

const SetupImageColumn = styled('div')`
  flex: 1;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: ${space(1)};

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    max-width: 100%;
    align-self: center;
  }
`;

const PreventAiImage = styled('img')`
  width: 100%;
  height: auto;
  border-radius: 8px;
  border: 1px solid ${p => p.theme.border};
  object-fit: contain;
`;

const PurpleText = styled('span')`
  color: ${p => p.theme.purple400};
  font-weight: ${p => p.theme.fontWeight.bold};
`;
