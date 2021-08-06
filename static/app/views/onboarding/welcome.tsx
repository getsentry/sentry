import {Component} from 'react';
import styled from '@emotion/styled';
import {motion, MotionProps} from 'framer-motion';
import {preloadIcons} from 'platformicons';

import Button from 'app/components/button';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {trackAdvancedAnalyticsEvent} from 'app/utils/advancedAnalytics';
import testableTransition from 'app/utils/testableTransition';

import FallingError from './components/fallingError';
import WelcomeBackground from './components/welcomeBackground';
import {StepProps} from './types';

type Props = StepProps;

const easterEggText = [
  t('Be careful. She’s barely hanging on as it is.'),
  t("You know this error's not real, right?"),
  t("It's that big button, right up there."),
  t('You could do this all day. But you really shouldn’t.'),
  tct("Ok, really, that's enough. Click [ready:I'm Ready].", {ready: <em />}),
  tct("Next time you do that, [bold:we're starting].", {bold: <strong />}),
  t("We weren't kidding, let's get going."),
];

const fadeAway: MotionProps = {
  variants: {
    initial: {opacity: 0},
    animate: {opacity: 1, filter: 'blur(0px)'},
    exit: {opacity: 0, filter: 'blur(1px)'},
  },
  transition: testableTransition({duration: 0.8}),
};

class OnboardingWelcome extends Component<Props> {
  componentDidMount() {
    // Next step will render the platform picker (using both large and small
    // icons). Keep things smooth by prefetching them. Preload a bit late to
    // avoid jank on welcome animations.
    setTimeout(preloadIcons, 1500);
    trackAdvancedAnalyticsEvent(
      'growth.onboarding_start_onboarding',
      {},
      this.props.organization ?? null
    );
  }

  render() {
    const {onComplete, active} = this.props;

    return (
      <FallingError
        onFall={fallCount => fallCount >= easterEggText.length && onComplete({})}
      >
        {({fallingError, fallCount, triggerFall}) => (
          <Wrapper>
            <WelcomeBackground />
            <motion.h1 {...fadeAway}>{t('Welcome to Sentry')}</motion.h1>
            <motion.p {...fadeAway}>
              {t(
                'Find the errors and performance slowdowns that keep you up at night. In two steps.'
              )}
            </motion.p>
            <CTAContainer {...fadeAway}>
              <Button
                data-test-id="welcome-next"
                disabled={!active}
                priority="primary"
                onClick={() => {
                  triggerFall();
                  onComplete({});
                }}
              >
                {t("I'm Ready")}
              </Button>
              <PositionedFallingError>{fallingError}</PositionedFallingError>
            </CTAContainer>
            <SecondaryAction {...fadeAway}>
              {fallCount > 0 ? easterEggText[fallCount - 1] : <br />}
            </SecondaryAction>
          </Wrapper>
        )}
      </FallingError>
    );
  }
}

const CTAContainer = styled(motion.div)`
  margin-bottom: ${space(2)};
  position: relative;

  button {
    position: relative;
    z-index: 2;
  }
`;

const PositionedFallingError = styled('span')`
  display: block;
  position: absolute;
  top: 30px;
  right: -5px;
  z-index: 0;
`;

const SecondaryAction = styled(motion.small)`
  color: ${p => p.theme.subText};
  margin-top: 100px;
`;

const Wrapper = styled(motion.div)`
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding-top: 100px;

  h1 {
    font-size: 42px;
  }
`;

Wrapper.defaultProps = {
  variants: {exit: {x: 0}},
  transition: testableTransition({
    staggerChildren: 0.2,
  }),
};

export default OnboardingWelcome;
