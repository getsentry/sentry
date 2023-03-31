import {Fragment, useCallback, useEffect} from 'react';
import styled from '@emotion/styled';
import {motion, MotionProps} from 'framer-motion';

import OnboardingInstall from 'sentry-images/spot/onboarding-install.svg';
import OnboardingSetup from 'sentry-images/spot/onboarding-setup.svg';

import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import Link from 'sentry/components/links/link';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import testableTransition from 'sentry/utils/testableTransition';
import useOrganization from 'sentry/utils/useOrganization';
import FallingError from 'sentry/views/onboarding/components/fallingError';
import WelcomeBackground from 'sentry/views/onboarding/components/welcomeBackground';

import {StepProps} from './types';
import {usePersistedOnboardingState} from './utils';

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
        <SubText>{subText}</SubText>
      </TextWrapper>
      <ButtonWrapper>{cta}</ButtonWrapper>
    </Fragment>
  );
}

function TargetedOnboardingWelcome({jumpToSetupProject, ...props}: StepProps) {
  const organization = useOrganization();
  const [clientState, setClientState] = usePersistedOnboardingState();

  const source = 'targeted_onboarding';

  useEffect(() => {
    trackAdvancedAnalyticsEvent('growth.onboarding_start_onboarding', {
      organization,
      source,
    });
  });

  // Jump to setup project if the backend set this state for us
  useEffect(() => {
    if (clientState?.state === 'projects_selected') {
      jumpToSetupProject();
    }
  }, [clientState, jumpToSetupProject]);

  const handleComplete = useCallback(() => {
    trackAdvancedAnalyticsEvent('growth.onboarding_clicked_instrument_app', {
      organization,
      source,
    });

    setClientState({
      platformToProjectIdMap: clientState?.platformToProjectIdMap ?? {},
      selectedPlatforms: [],
      url: 'select-platform/',
      state: 'started',
    });

    props.onComplete();
  }, [organization, source, clientState, setClientState, props]);

  const handleSkipOnboarding = useCallback(() => {
    trackAdvancedAnalyticsEvent('growth.onboarding_clicked_skip', {
      organization,
      source,
    });

    setClientState({
      platformToProjectIdMap: clientState?.platformToProjectIdMap ?? {},
      selectedPlatforms: [],
      url: 'welcome/',
      state: 'skipped',
    });
  }, [organization, source, clientState, setClientState]);

  return (
    <FallingError>
      {({fallingError, fallCount, isFalling}) => (
        <Wrapper>
          <WelcomeBackground />
          <motion.h1 {...fadeAway} style={{marginBottom: space(0.5)}}>
            {t('Welcome to Sentry')}
          </motion.h1>
          <SubHeaderText style={{marginBottom: space(4)}} {...fadeAway}>
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
                  <ButtonWithFill onClick={handleComplete} priority="primary">
                    {t('Start')}
                  </ButtonWithFill>
                  {(fallCount === 0 || isFalling) && (
                    <PositionedFallingError>{fallingError}</PositionedFallingError>
                  )}
                </Fragment>
              }
            />
          </ActionItem>
          <ActionItem {...fadeAway}>
            <InnerAction
              title={t('Set up my team')}
              subText={tct(
                'Invite [friends] coworkers. You shouldn’t have to fix what you didn’t break',
                {friends: <Strike>{t('friends')}</Strike>}
              )}
              src={OnboardingSetup}
              cta={
                <ButtonWithFill
                  onClick={() => {
                    openInviteMembersModal({source});
                  }}
                  priority="primary"
                >
                  {t('Invite Team')}
                </ButtonWithFill>
              }
            />
          </ActionItem>
          <motion.p style={{margin: 0}} {...fadeAway}>
            {t("Gee, I've used Sentry before.")}
            <br />
            <Link
              onClick={handleSkipOnboarding}
              to={`/organizations/${organization.slug}/issues/?referrer=onboarding-welcome-skip`}
            >
              {t('Skip onboarding.')}
            </Link>
          </motion.p>
        </Wrapper>
      )}
    </FallingError>
  );
}

export default TargetedOnboardingWelcome;

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
  border-radius: ${space(0.5)};
  padding: ${space(2)};
  margin-bottom: ${space(2)};
  justify-content: space-around;
  border: 1px solid ${p => p.theme.gray200};
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: grid;
    grid-template-columns: 125px auto 125px;
    width: 680px;
    align-items: center;
  }
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
    flex-direction: column;
  }
`;

const TextWrapper = styled('div')`
  text-align: left;
  margin: auto ${space(3)};
  min-height: 70px;
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    text-align: center;
    margin: ${space(1)} ${space(1)};
    margin-top: ${space(3)};
  }
`;

const Strike = styled('span')`
  text-decoration: line-through;
`;

const ActionTitle = styled('h5')`
  font-weight: 900;
  margin: 0 0 ${space(0.5)};
  color: ${p => p.theme.gray400};
`;

const SubText = styled('span')`
  font-weight: 400;
  color: ${p => p.theme.gray400};
`;

const SubHeaderText = styled(motion.h6)`
  color: ${p => p.theme.gray300};
`;

const ButtonWrapper = styled('div')`
  margin: ${space(1)};
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
