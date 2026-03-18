import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {MotionProps} from 'framer-motion';
import {motion} from 'framer-motion';

import OnboardingInstall from 'sentry-images/spot/onboarding-install.svg';

import {Button} from '@sentry/scraps/button';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {testableTransition} from 'sentry/utils/testableTransition';
import FallingError from 'sentry/views/onboarding/components/fallingError';
import {WelcomeBackground} from 'sentry/views/onboarding/components/welcomeBackground';
import {WelcomeSkipButton} from 'sentry/views/onboarding/components/welcomeSkipButton';
import {useWelcomeAnalyticsEffect} from 'sentry/views/onboarding/useWelcomeAnalyticsEffect';
import {useWelcomeHandleComplete} from 'sentry/views/onboarding/useWelcomeHandleComplete';

import type {StepProps} from './types';

const fadeAway: MotionProps = {
  variants: {
    initial: {opacity: 0},
    animate: {opacity: 1, filter: 'blur(0px)'},
    exit: {opacity: 0, filter: 'blur(1px)'},
  },
  transition: testableTransition({duration: 0.8}),
};

type TextWrapperProps = {
  cta: React.ReactNode;
  src: string;
  subText: React.ReactNode;
  title: React.ReactNode;
};

function InnerAction({title, subText, cta, src}: TextWrapperProps) {
  return (
    <Fragment>
      <ActionImage src={src} />
      <TextWrapper>
        <ActionTitle>{title}</ActionTitle>
        <Text variant="muted">{subText}</Text>
      </TextWrapper>
      <ButtonWrapper>{cta}</ButtonWrapper>
    </Fragment>
  );
}

export function TargetedOnboardingWelcome(props: StepProps) {
  const theme = useTheme();
  useWelcomeAnalyticsEffect();

  const handleComplete = useWelcomeHandleComplete(props.onComplete);

  return (
    <FallingError>
      {({fallingError, fallCount, isFalling}) => (
        <Wrapper>
          <WelcomeBackground />
          <motion.h1 {...fadeAway} style={{marginBottom: theme.space.xs}}>
            {t('Welcome to Sentry')}
          </motion.h1>
          <SubHeaderText style={{marginBottom: theme.space['3xl']}} {...fadeAway}>
            {t(
              'Your code is probably broken. Maybe not. Find out for sure. Get started below.'
            )}
          </SubHeaderText>
          <ActionItem {...fadeAway}>
            <InnerAction
              title={t('Install Sentry')}
              subText={t(
                'Select your languages or frameworks and install the SDKs to start tracking issues'
              )}
              src={OnboardingInstall}
              cta={
                <Fragment>
                  <ButtonWithFill
                    onClick={handleComplete}
                    priority="primary"
                    data-test-id="onboarding-welcome-start"
                  >
                    {t('Start')}
                  </ButtonWithFill>
                  {(fallCount === 0 || isFalling) && (
                    <PositionedFallingError>{fallingError}</PositionedFallingError>
                  )}
                </Fragment>
              }
            />
          </ActionItem>
          <motion.p style={{margin: 0}} {...fadeAway}>
            {t("Gee, I've used Sentry before.")}
            <br />
            <WelcomeSkipButton>{t('Skip onboarding.')}</WelcomeSkipButton>
          </motion.p>
        </Wrapper>
      )}
    </FallingError>
  );
}

const PositionedFallingError = styled('span')`
  display: block;
  position: absolute;
  right: 0px;
  top: 30px;
`;

const Wrapper = styled(motion.div)`
  position: relative;
  margin-top: auto;
  margin-bottom: auto;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-left: auto;
  margin-right: auto;

  h1 {
    font-size: 42px;
  }
`;

const ActionItem = styled(motion.div)`
  min-height: 120px;
  border-radius: ${p => p.theme.space.xs};
  padding: ${p => p.theme.space.xl};
  margin-bottom: ${p => p.theme.space.xl};
  justify-content: space-around;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    display: grid;
    grid-template-columns: 125px auto 125px;
    width: 680px;
    align-items: center;
  }
  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: flex;
    flex-direction: column;
  }
`;

const TextWrapper = styled('div')`
  text-align: left;
  margin: auto ${p => p.theme.space['2xl']};
  min-height: 70px;
  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    text-align: center;
    margin: ${p => p.theme.space.md} ${p => p.theme.space.md};
    margin-top: ${p => p.theme.space['2xl']};
  }
`;

const ActionTitle = styled('h5')`
  font-weight: ${p => p.theme.font.weight.sans.medium};
  margin: 0 0 ${p => p.theme.space.xs};
  color: ${p => p.theme.tokens.content.primary};
`;

const SubHeaderText = styled(motion.h6)`
  color: ${p => p.theme.tokens.content.secondary};
`;

const ButtonWrapper = styled('div')`
  margin: ${p => p.theme.space.md};
  position: relative;
`;

const ActionImage = styled('img')`
  height: 100px;
`;

const ButtonWithFill = styled(Button)`
  width: 100%;
  position: relative;
  z-index: 1;
`;
