import * as React from 'react';
import styled from '@emotion/styled';
import {motion, MotionProps} from 'framer-motion';

import OnboardingInstall from 'sentry-images/spot/onboarding-install.svg';
import OnboardingPreview from 'sentry-images/spot/onboarding-preview.svg';
import OnboardingSetup from 'sentry-images/spot/onboarding-setup.svg';

import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import DemoSandboxButton from 'sentry/components/demoSandboxButton';
import Link from 'sentry/components/links/link';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import testableTransition from 'sentry/utils/testableTransition';
import withOrganization from 'sentry/utils/withOrganization';
import FallingError from 'sentry/views/onboarding/components/fallingError';

import WelcomeBackground from './components/welcomeBackground';

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
    <React.Fragment>
      <ActionImage src={src} />
      <TextWrapper>
        <ActionTitle>{title}</ActionTitle>
        <SubText>{subText}</SubText>
      </TextWrapper>
      <ButtonWrapper>{cta}</ButtonWrapper>
    </React.Fragment>
  );
}

type Props = {
  organization: Organization;
};

function TargetedOnboardingWelcome({organization}: Props) {
  const source = 'targeted_onboarding';
  React.useEffect(() => {
    trackAdvancedAnalyticsEvent('growth.onboarding_start_onboarding', {
      organization,
      source,
    });
  });
  return (
    <FallingError>
      {({fallingError}) => (
        <Wrapper>
          <WelcomeBackground />
          <motion.h1 {...fadeAway}>{t('Welcome to Sentry')}</motion.h1>
          <SubHeaderText {...fadeAway}>
            {t('Your code is probably broken. Maybe not.')}
            <br />
            {t('Find out for sure. Get started below.')}
          </SubHeaderText>
          <ActionItem>
            <InnerAction
              title={t('Install Sentry')}
              subText={t(
                'Select your lanaguages or frameworks and install the SDKs to start tracking issues'
              )}
              src={OnboardingInstall}
              cta={
                <ButtonWithFill
                  onClick={() => {
                    trackAdvancedAnalyticsEvent(
                      'growth.onboarding_clicked_instrument_app',
                      {
                        organization,
                        source,
                      }
                    );
                    window.location.replace(
                      `/onboarding/${organization.slug}/select-platform/`
                    );
                  }}
                  priority="primary"
                >
                  {t('Start')}
                </ButtonWithFill>
              }
            />
          </ActionItem>
          <ActionItem>
            <InnerAction
              title={t('Setup my team')}
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
          {!organization.features.includes('sandbox-kill-switch') && (
            <ActionItem>
              <InnerAction
                title={t('Preview before you (git) commit')}
                subText={t(
                  'Check out sample issue reports, transactions, and tour all of Sentry '
                )}
                src={OnboardingPreview}
                cta={
                  <React.Fragment>
                    <SandboxWithFill scenario="oneIssue" priority="primary" {...{source}}>
                      {t('Explore')}
                    </SandboxWithFill>
                    <PositionedFallingError>{fallingError}</PositionedFallingError>
                  </React.Fragment>
                }
              />
            </ActionItem>
          )}
          <motion.p>
            {t("Gee, I've used Sentry before.")}
            <br />
            <Link
              onClick={() =>
                trackAdvancedAnalyticsEvent('growth.onboarding_clicked_skip', {
                  organization,
                  source,
                })
              }
              to={`/organizations/${organization.slug}/issues/`}
            >
              {t('Skip onboarding.')}
            </Link>
          </motion.p>
        </Wrapper>
      )}
    </FallingError>
  );
}

export default withOrganization(TargetedOnboardingWelcome);

const PositionedFallingError = styled('span')`
  display: block;
  z-index: 0;
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

const ActionItem = styled('div')`
  min-height: 120px;
  border-radius: ${space(0.5)};
  padding: ${space(2)};
  margin-bottom: ${space(2)};
  justify-content: space-around;
  border: 1px solid ${p => p.theme.gray200};
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: grid;
    grid-template-columns: 125px auto 125px;
    width: 680px;
  }
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: flex;
    flex-direction: column;
  }
`;

const TextWrapper = styled('div')`
  text-align: left;
  margin: auto ${space(3)};
  min-height: 70px;
`;

const Strike = styled('span')`
  text-decoration: line-through;
`;

const ActionTitle = styled('h5')`
  font-weight: 500;
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
  display: flex;
  flex-diretion: @media (min-width: ${p => p.theme.breakpoints[0]}) {
    justify-content: center;
    align-items: center;
  }
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    justify-content: flex-end;
  }
`;

const ActionImage = styled('img')`
  height: 100px;
`;

const ButtonWithFill = styled(Button)`
  min-width: -webkit-fill-available;
`;

const SandboxWithFill = styled(DemoSandboxButton)`
  min-width: -webkit-fill-available;
`;
