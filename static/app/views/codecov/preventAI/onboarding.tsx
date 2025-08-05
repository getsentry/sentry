import {Fragment} from 'react';
import styled from '@emotion/styled';

import preventHero from 'sentry-images/features/prevent-hero.svg';
import preventPrComments from 'sentry-images/features/prevent-pr-comments.svg';

import {ExternalLink} from 'sentry/components/core/link';
import {t} from 'sentry/locale';

interface OnboardingStepProps {
  description: React.ReactNode;
  step: number;
  title: string;
}

function OnboardingStep({step, title, description}: OnboardingStepProps) {
  return (
    <StepContainer>
      <StepNumber>{step}</StepNumber>
      <StepContent>
        <StyledH6>{title}</StyledH6>
        <StyledP>{description}</StyledP>
      </StepContent>
    </StepContainer>
  );
}

export default function PreventAIOnboarding() {
  return (
    <Fragment>
      <Container style={{justifyContent: 'space-around'}}>
        <StyledImg src={preventHero} alt="Prevent AI Hero" />
        <RightSideContainer>
          <StyledH3>
            {t('Ship Code That Breaks Less With Code Reviews And Tests')}
          </StyledH3>
          <StyledP>
            {t('Prevent AI is an AI agent that automates tasks in your PR:')}
          </StyledP>
          <StyledUl>
            <li>
              {t(
                'It reviews your pull requests, predicting errors and suggesting code fixes'
              )}
            </li>
            <li>{t('It generates unit tests for untested code in your PR')}</li>
          </StyledUl>
        </RightSideContainer>
      </Container>
      <Container>
        <LeftSideContainer>
          <HeaderContainer>
            <StyledH4>{t('Setup Prevent AI')}</StyledH4>

            <StyledP>
              {t(
                `These setups must be installed or approved by an admin. If you're not an admin, reach out to your organization's admins to ensure they approve the installation.`
              )}
            </StyledP>
          </HeaderContainer>
          <OnboardingStep
            step={1}
            title={t(`Enable Generative AI features`)}
            description={t(
              'Make sure AI features are enabled in your organization settings.'
            )}
          />
          <OnboardingStep
            step={2}
            title={t(`Setup GitHub Integration`)}
            description={
              <Fragment>
                {t('To grant Seer access to your codebase, follow these ')}{' '}
                <ExternalLink href="https://docs.sentry.io/organization/integrations/source-code-mgmt/github/#installing-github">
                  {t('GitHub integration instructions')}
                </ExternalLink>
                {t(
                  ': 1. Install the Sentry GitHub app. 2. Connect your GitHub repositories.'
                )}
              </Fragment>
            }
          />
          <OnboardingStep
            step={3}
            title={t(`Setup Seer`)}
            description={
              <Fragment>
                {t('Install the ')}{' '}
                <ExternalLink href="https://github.com/apps/seer-by-sentry">
                  {t('Seer by Sentry GitHub App')}
                </ExternalLink>{' '}
                {t('within the same GitHub organization.')}
              </Fragment>
            }
          />

          <GrayContainer>
            <BoldP>{t('How to use Prevent AI')}</BoldP>
            <StyledP>
              {t('Prevent AI helps you ship better code with three features')}
            </StyledP>
            <ul>
              <li>
                {t(
                  'It reviews your code, suggesting broader fixes when you prompt @sentry review'
                )}
              </li>
              <li>
                {t(
                  'It predicts which errors your code will cause. This happens automatically on every commit, when you mark a PR ready for review, and when you trigger a PR review with @sentry review.'
                )}
              </li>
              <li>
                {t(
                  'It generates unit tests for your PR when you prompt @sentry generate-test.'
                )}
              </li>
            </ul>
            <StyledP>
              {t(
                'Sentry Error Prediction works better with Sentry Issue Context. Learn more on how to set this up to get the most accurate error prediction we can offer.'
              )}
            </StyledP>
          </GrayContainer>
        </LeftSideContainer>
        <StyledImg
          style={{maxWidth: '40%'}}
          src={preventPrComments}
          alt="Prevent PR Comments"
        />
      </Container>
    </Fragment>
  );
}

const Container = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${p => p.theme.space.md};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${p => p.theme.space.xl} ${p => p.theme.space['2xl']};
  margin-bottom: ${p => p.theme.space['2xl']};
  max-width: 1000px;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    flex-direction: column;
  }
`;

const LeftSideContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  max-width: 600px;
`;

const HeaderContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  padding-bottom: ${p => p.theme.space.lg};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const GrayContainer = styled('div')`
  background-color: ${p => p.theme.backgroundSecondary};
  padding: ${p => p.theme.space.md};
  border-radius: ${p => p.theme.borderRadius};
`;

const BoldP = styled('p')`
  font-weight: bold;
  margin: 0px;
`;

const StyledH6 = styled('h6')`
  margin: 0;
`;

const StyledH4 = styled('h4')`
  margin: 0;
  margin-top: ${p => p.theme.space.xl};
`;

const StyledH3 = styled('h3')`
  margin: 0;
  max-width: 400px;
  margin-top: ${p => p.theme.space['2xl']};
`;

const StyledP = styled('p')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.md};
`;

const RightSideContainer = styled('div')`
  display: flex;
  max-width: 500px;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
`;

const StyledUl = styled('ul')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.md};
`;

const StyledImg = styled('img')`
  overflow: hidden;
  max-width: 30%;
  margin-top: ${p => p.theme.space['2xl']};
  margin-bottom: ${p => p.theme.space['2xl']};
`;

const StepContainer = styled('div')`
  display: flex;
  align-items: flex-start;
  gap: ${p => p.theme.space.md};
  margin-top: ${p => p.theme.space.lg};
`;

const StepNumber = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background-color: ${p => p.theme.purple300};
  color: ${p => p.theme.white};
  border-radius: 50%;
  font-size: ${p => p.theme.fontSize.md};
  font-weight: 600;
  margin-top: 2px;
`;

const StepContent = styled('div')`
  flex: 1;
`;
