import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button, {ButtonPropsWithoutAriaLabel} from 'sentry/components/button';
import {t} from 'sentry/locale';

// This is just a doubly linked list of steps
interface OnboardingStep {
  current: React.ComponentType<OnboardingStepProps>;
  next: OnboardingStep | null;
  previous: OnboardingStep | null;
}

type OnboardingRouterState = [OnboardingStep, (step: OnboardingStep | null) => void];
function useOnboardingRouter(initialStep: OnboardingStep): OnboardingRouterState {
  const [state, setState] = useState(initialStep);

  const toStep = useCallback((nextStep: OnboardingStep | null) => {
    // For ergonomics, else we need to move everything to consts so that typescript can infer non nullable types
    if (nextStep === null) {
      return;
    }

    setState(current => {
      const next = {...nextStep, next: null, previous: current};
      // Add the edges between the old and the new step
      current.next = next;
      next.previous = current;
      // Return the neext step
      return next;
    });
  }, []);

  return [state, toStep];
}

interface ProfilingOnboardingModalProps extends ModalRenderProps {}
export function ProfilingOnboardingModal(props: ProfilingOnboardingModalProps) {
  const [state, toStep] = useOnboardingRouter({
    previous: null,
    current: SelectProjectStep,
    next: null,
  });
  return <state.current {...props} toStep={toStep} step={state} />;
}

// Individual modal steps are defined here.
// We proxy the modal props to each individaul modal component
// so that each can build their own modal and they can remain independent.
interface OnboardingStepProps extends ModalRenderProps {
  step: OnboardingStep;
  toStep: OnboardingRouterState[1];
}

function SelectProjectStep({
  Body: ModalBody,
  Header: ModalHeader,
  Footer: ModalFooter,
  toStep,
  step,
}: OnboardingStepProps) {
  const onNext = useCallback(
    (platform: 'iOS' | 'Android') => {
      toStep({
        previous: step,
        current:
          platform === 'Android'
            ? AndroidSendDebugFilesInstruction
            : IOSSendDebugFilesInstruction,
        next: null,
      });
    },
    [step, toStep]
  );

  return (
    <ModalBody>
      <ModalHeader>Select a Project</ModalHeader>
      <ModalFooter>
        <ModalActions>
          <NextStepButton onClick={() => onNext('Android')} />
          <NextStepButton onClick={() => onNext('iOS')} />
        </ModalActions>
      </ModalFooter>
    </ModalBody>
  );
}

function AndroidSendDebugFilesInstruction({
  Body: ModalBody,
  Header: ModalHeader,
  Footer: ModalFooter,
  toStep,
  step,
}: OnboardingStepProps) {
  return (
    <ModalBody>
      <ModalHeader>Send Debug Files For Android</ModalHeader>
      <ModalFooter>
        <ModalActions>
          {step.previous ? (
            <PreviousStepButton onClick={() => toStep(step.previous)} />
          ) : null}
        </ModalActions>
      </ModalFooter>
    </ModalBody>
  );
}

function IOSSendDebugFilesInstruction({
  Body: ModalBody,
  Header: ModalHeader,
  Footer: ModalFooter,
  toStep,
  step,
}: OnboardingStepProps) {
  // Required as typescript cannot properly infer the previous step
  return (
    <ModalBody>
      <ModalHeader>Send Debug Files For iOS</ModalHeader>
      <ModalFooter>
        <ModalActions>
          {step.previous !== null ? (
            <PreviousStepButton onClick={() => toStep(step.previous)} />
          ) : null}
        </ModalActions>
      </ModalFooter>
    </ModalBody>
  );
}

type StepButtonProps = Omit<ButtonPropsWithoutAriaLabel, 'children'>;
// Common component definitions
function NextStepButton(props: StepButtonProps) {
  return (
    <Button priority="primary" {...props}>
      {t('Next')}
    </Button>
  );
}

function PreviousStepButton(props: StepButtonProps) {
  return <Button {...props}>{t('Back')}</Button>;
}

interface ModalActionsProps {
  children: React.ReactNode;
}
function ModalActions({children}: ModalActionsProps) {
  return <ModalActionsContainer>{children}</ModalActionsContainer>;
}

const ModalActionsContainer = styled('div')`
  display: flex;
  justify-content: space-between;
`;
