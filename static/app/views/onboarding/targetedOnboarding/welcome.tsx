import * as React from 'react';
import styled from '@emotion/styled';
import {motion, MotionProps} from 'framer-motion';

import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import DemoSandboxButton from 'sentry/components/demoSandboxButton';
import Link from 'sentry/components/links/link';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import testableTransition from 'sentry/utils/testableTransition';
import withOrganization from 'sentry/utils/withOrganization';
import WelcomeBackground from 'sentry/views/onboarding/components/welcomeBackground';

const fadeAway: MotionProps = {
  variants: {
    initial: {opacity: 0},
    animate: {opacity: 1, filter: 'blur(0px)'},
    exit: {opacity: 0, filter: 'blur(1px)'},
  },
  transition: testableTransition({duration: 0.8}),
};

type TextWrapperProps = {
  subText: React.ReactNode;
  title: React.ReactNode;
};

function InnerAction({title, subText}: TextWrapperProps) {
  return (
    <React.Fragment>
      <TextWrapper>
        <ActionTitle>{title}</ActionTitle>
        <SubText>{subText}</SubText>
      </TextWrapper>
      <IconChevron direction="right" />
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
    <Wrapper>
      <WelcomeBackground />
      <motion.h1 {...fadeAway}>{t('Welcome to Sentry')}</motion.h1>
      <SubHeaderText {...fadeAway}>
        {t('Your code is probably broken.')}
        <br />
        {t('Maybe not. Find out in two steps.')}
      </SubHeaderText>
      <ActionItem
        onClick={() => {
          trackAdvancedAnalyticsEvent('growth.onboarding_clicked_instrument_app', {
            organization,
            source,
          });
          window.location.replace(`/onboarding/${organization.slug}/select-platform/`);
        }}
      >
        <InnerAction
          title={t('Install Sentry')}
          subText={t(
            'Select your lanaguages or frameworks and install the SDKs to start tracking issues'
          )}
        />
      </ActionItem>
      <ActionItem
        onClick={() => {
          openInviteMembersModal({source});
        }}
      >
        <InnerAction
          title={t('Setup my team')}
          subText={tct(
            'Invite [friends] coworkers. You shouldn’t have to fix what you didn’t break',
            {friends: <Strike>{t('friends')}</Strike>}
          )}
        />
      </ActionItem>
      {!organization.features.includes('sandbox-kill-switch') && (
        <SandboxAction scenario="oneIssue" {...{source}}>
          <InnerAction
            title={t('Preview before you (git) commit')}
            subText={t(
              'Check out sample issue reports, transactions, and tour all of Sentry '
            )}
          />
        </SandboxAction>
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
  );
}

export default withOrganization(TargetedOnboardingWelcome);

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

const actionStyles = `
  width: 680px;
  height: 90px;
  border-radius: ${space(0.5)};
  margin: ${space(2)};
  justify-content: flex-end;
  display: flex;
`;

const ActionItem = styled(Button)`
  ${actionStyles};
`;

const SandboxAction = styled(DemoSandboxButton)`
  ${actionStyles};
`;

const TextWrapper = styled('div')`
  text-align: left;
`;

const Strike = styled('span')`
  text-decoration: line-through;
`;

const ActionTitle = styled('h5')`
  font-weight: 500;
  margin: 0 0 ${space(2)};
  color: ${p => p.theme.gray400};
`;

const SubText = styled('span')`
  font-weight: 400;
  color: ${p => p.theme.gray400};
`;

const SubHeaderText = styled(motion.h6)`
  color: ${p => p.theme.gray300};
`;
