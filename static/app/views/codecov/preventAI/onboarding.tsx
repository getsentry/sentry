import {Fragment} from 'react';
import styled from '@emotion/styled';

import preventHero from 'sentry-images/features/prevent-hero.svg';
import preventPrComments from 'sentry-images/features/prevent-pr-comments.svg';

import {t} from 'sentry/locale';

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
          <StyledH6>{t(`Enable Generative AI features`)}</StyledH6>
          <StyledP>
            {t('Make sure AI features are enabled in your organization settings.')}
          </StyledP>
          <StyledH6>{t(`Setup GitHub Integration`)}</StyledH6>
          <StyledP>
            {t(
              'To grant Seer access to your codebase, follow these GitHub integration instructions: 1. Install the Sentry GitHub app. 2. Connect your GitHub repositories.'
            )}
          </StyledP>
          <StyledH6>{t(`Setup Seer`)}</StyledH6>
          <StyledP>
            {t(
              'Install the Seer by Sentry GitHub App within the same GitHub organization.'
            )}
          </StyledP>
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
  max-width: 700px;
`;

const HeaderContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  padding-bottom: ${p => p.theme.space.lg};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const StyledH6 = styled('h6')`
  margin: 0;
  margin-top: ${p => p.theme.space.lg};
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
