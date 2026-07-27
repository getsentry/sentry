import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {MotionProps} from 'framer-motion';
import {motion} from 'framer-motion';

import OnboardingInstall from 'sentry-images/spot/onboarding-install.svg';

import {Button} from '@sentry/scraps/button';
import {Image} from '@sentry/scraps/image';
import {
  Container,
  type ContainerProps,
  Stack,
  type StackProps,
} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {FallingError} from 'sentry/views/onboarding/components/fallingError';
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
  transition: {duration: 0.8},
};

type TextWrapperProps = {
  cta: React.ReactNode;
  src: string;
  subText: React.ReactNode;
  title: React.ReactNode;
};

// Centered while the card is narrow, left-aligned once it widens — the same
// container breakpoint TextWrapper's margins flip on.
const textAlign = {zero: 'center', sm: 'left'} as const;

function InnerAction({title, subText, cta, src}: TextWrapperProps) {
  return (
    <Fragment>
      <Image src={src} alt="" height="100px" />
      <TextWrapper>
        {/* size follows base.less's h5 (20px); Heading's h5 default is smaller. */}
        <Heading as="h5" size="xl" align={textAlign}>
          {title}
        </Heading>
        <Text variant="muted" align={textAlign}>
          {subText}
        </Text>
      </TextWrapper>
      <Container margin="md" position="relative">
        {cta}
      </Container>
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
                    variant="primary"
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

function PositionedFallingError(props: ContainerProps<'span'>) {
  return (
    <Container
      as="span"
      display="block"
      position="absolute"
      right={0}
      top="30px"
      {...props}
    />
  );
}

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

// The card deliberately overflows its 400px-max Wrapper to 680px, so no
// ancestor measures what this switch needs and the card can't query itself —
// the grid/flex flip stays viewport-driven. It is a query container for its own
// contents, which do have a real width to respond to (680px wide vs 400px).
const ActionItem = styled(motion.div)`
  min-height: 120px;
  border-radius: ${p => p.theme.space.xs};
  padding: ${p => p.theme.space.xl};
  margin-bottom: ${p => p.theme.space.xl};
  justify-content: space-around;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  container-type: inline-size;
  /* Inline-size containment stops the contents from sizing the card, so without
     an explicit width it collapses. Declared here, not in the max-width branch,
     so the 680px below still wins at exactly sm, where both queries apply. */
  width: 100%;
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

// The card only has two widths — its content box is 366px narrow and 646px wide
// — so the threshold just has to separate them. sm sits near the middle of that
// gap; lg (640px) also matches today but clears the wide state by only 6px.
// Margins rather than gap: they differ per side and flip with the breakpoint.
// Text alignment lives on the Text/Heading children — layout primitives have no
// text-align prop, and the original set it here only to be inherited.
function TextWrapper(props: StackProps) {
  return (
    <Stack
      gap="xs"
      minHeight="70px"
      margin={{zero: '2xl md md', sm: 'auto 2xl'}}
      {...props}
    />
  );
}

// Stays an h6: base.less renders it at 18px and the type scale has no 18px
// token, so Heading would resize it (16px or 20px). Out of scope for a
// migration that should be visually neutral.
const SubHeaderText = styled(motion.h6)`
  color: ${p => p.theme.tokens.content.secondary};
`;

const ButtonWithFill = styled(Button)`
  width: 100%;
  position: relative;
  z-index: 1;
`;
