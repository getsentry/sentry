import * as React from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, useAnimation} from 'framer-motion';

import Hook from 'sentry/components/hook';
import LogoSentry from 'sentry/components/logoSentry';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import PageCorners from 'sentry/views/onboarding/components/pageCorners';

import TargetedOnboardingWelcome from './welcome';

export default function Onboarding() {
  const cornerVariantControl = useAnimation();
  const updateCornerVariant = () => {
    cornerVariantControl.start('top-right');
  };

  // XXX(epurkhiser): We're using a react hook here becuase there's no other
  // way to create framer-motion controls than by using the `useAnimation`
  // hook.

  React.useEffect(updateCornerVariant, []);
  return (
    <OnboardingWrapper data-test-id="targeted-onboarding">
      <SentryDocumentTitle title={t('Welcome')} />
      <Header>
        <LogoSvg />
        <Hook name="onboarding:targeted-onboarding-header" />
      </Header>
      <Container>
        <AnimatePresence exitBeforeEnter onExitComplete={updateCornerVariant}>
          <TargetedOnboardingWelcome />
        </AnimatePresence>
        <PageCorners animateVariant={cornerVariantControl} />
      </Container>
    </OnboardingWrapper>
  );
}

const OnboardingWrapper = styled('main')`
  overflow: hidden;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
`;

const Container = styled('div')`
  display: flex;
  justify-content: center;
  position: relative;
  background: ${p => p.theme.background};
  padding: 120px ${space(3)};
  padding-top: 12vh;
  width: 100%;
  margin: 0 auto;
  flex-grow: 1;
`;

const Header = styled('header')`
  background: ${p => p.theme.background};
  padding: ${space(4)};
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.05);
  display: flex;
  justify-content: space-between;
`;

const LogoSvg = styled(LogoSentry)`
  width: 130px;
  height: 30px;
  color: ${p => p.theme.textColor};
`;
