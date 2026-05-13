import {Fragment, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {openModal, type ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {ONBOARDING_STEPS} from 'sentry/views/seerWorkflows/onboardingSteps';

function OnboardingModal({Header, Body, Footer, closeModal}: ModalRenderProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;
  const step = ONBOARDING_STEPS[currentStep]!;
  const showStepCounter = ONBOARDING_STEPS.length > 1;

  const goNext = () => {
    if (isLastStep) {
      closeModal();
    } else {
      setCurrentStep(s => s + 1);
    }
  };

  const goBack = () => setCurrentStep(s => Math.max(0, s - 1));

  return (
    <Fragment>
      <Header closeButton>
        <Flex direction="column" gap="2xs">
          {showStepCounter ? (
            <Text size="xs" variant="muted" uppercase>
              {t('Step %s of %s', currentStep + 1, ONBOARDING_STEPS.length)}
            </Text>
          ) : null}
          <Heading as="h3">{step.title}</Heading>
        </Flex>
      </Header>
      <Body>{step.body}</Body>
      <Footer>
        <Flex justify="between" align="center" width="100%">
          {isFirstStep ? <span /> : <Button onClick={goBack}>{t('Back')}</Button>}
          <Flex gap="sm">
            <Button onClick={closeModal}>{t('Skip')}</Button>
            <Button priority="primary" onClick={goNext}>
              {isLastStep ? t('Done') : t('Next')}
            </Button>
          </Flex>
        </Flex>
      </Footer>
    </Fragment>
  );
}

export function openOnboardingModal(options?: {onClose?: () => void}) {
  openModal(deps => <OnboardingModal {...deps} />, {
    onClose: options?.onClose,
  });
}
