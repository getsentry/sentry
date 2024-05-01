import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styled from '@emotion/styled';
import orderBy from 'lodash/orderBy';

import {type BaseButtonProps, Button} from 'sentry/components/button';
import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type GuidedStepsProps = {
  children: React.ReactElement<StepProps> | React.ReactElement<StepProps>[];
  className?: string;
  onStepChange?: (step: number) => void;
};

interface GuidedStepsContextState {
  currentStep: number;
  getStepNumber: (stepKey: string) => number;
  registerStep: (step: RegisterStepInfo) => void;
  setCurrentStep: (step: number) => void;
  totalSteps: number;
}

interface StepProps {
  children: React.ReactNode;
  stepKey: string;
  title: string;
  isCompleted?: boolean;
}

type RegisterStepInfo = Pick<StepProps, 'stepKey' | 'isCompleted'>;
type RegisteredSteps = {[key: string]: {stepNumber: number; isCompleted?: boolean}};

const GuidedStepsContext = createContext<GuidedStepsContextState>({
  currentStep: 0,
  setCurrentStep: () => {},
  totalSteps: 0,
  registerStep: () => 0,
  getStepNumber: () => 0,
});

export function useGuidedStepsContext() {
  return useContext(GuidedStepsContext);
}

function useGuidedStepsContentValue({
  onStepChange,
}: Pick<GuidedStepsProps, 'onStepChange'>): GuidedStepsContextState {
  const registeredStepsRef = useRef<RegisteredSteps>({});
  const [totalSteps, setTotalSteps] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Steps are registered on initial render to determine the step order and which step to start on.
  // This allows Steps to be wrapped in other components, but does require that they exist on first
  // render and that step order does not change.
  const registerStep = useCallback((props: RegisterStepInfo) => {
    if (registeredStepsRef.current[props.stepKey]) {
      return;
    }
    const numRegisteredSteps = Object.keys(registeredStepsRef.current).length + 1;
    registeredStepsRef.current[props.stepKey] = {
      isCompleted: props.isCompleted,
      stepNumber: numRegisteredSteps,
    };
    setTotalSteps(numRegisteredSteps);
  }, []);

  const getStepNumber = useCallback((stepKey: string) => {
    return registeredStepsRef.current[stepKey]?.stepNumber ?? 1;
  }, []);

  // On initial load, set the current step to the first incomplete step
  useEffect(() => {
    const firstIncompleteStep = orderBy(
      Object.values(registeredStepsRef.current),
      'stepNumber'
    ).find(step => step.isCompleted !== true);

    setCurrentStep(firstIncompleteStep?.stepNumber ?? 1);
  }, []);

  const handleSetCurrentStep = useCallback(
    (step: number) => {
      setCurrentStep(step);
      onStepChange?.(step);
    },
    [onStepChange]
  );

  return useMemo(
    () => ({
      currentStep,
      setCurrentStep: handleSetCurrentStep,
      totalSteps,
      registerStep,
      getStepNumber,
    }),
    [currentStep, getStepNumber, handleSetCurrentStep, registerStep, totalSteps]
  );
}

function Step(props: StepProps) {
  const {currentStep, registerStep, getStepNumber} = useGuidedStepsContext();
  const stepNumber = getStepNumber(props.stepKey);
  const isActive = currentStep === stepNumber;
  const isCompleted = props.isCompleted ?? currentStep > stepNumber;

  useEffect(() => {
    registerStep({isCompleted: props.isCompleted, stepKey: props.stepKey});
  }, [props.isCompleted, props.stepKey, registerStep]);

  return (
    <StepWrapper data-test-id={`guided-step-${stepNumber}`}>
      <StepNumber isActive={isActive}>{stepNumber}</StepNumber>
      <StepDetails>
        <StepHeading isActive={isActive}>
          {props.title}
          {isCompleted && <StepDoneIcon isActive={isActive} size="sm" />}
        </StepHeading>
        {isActive && (
          <ChildrenWrapper isActive={isActive}>{props.children}</ChildrenWrapper>
        )}
      </StepDetails>
    </StepWrapper>
  );
}

function BackButton({children, ...props}: BaseButtonProps) {
  const {currentStep, setCurrentStep} = useGuidedStepsContext();

  if (currentStep === 1) {
    return null;
  }

  return (
    <Button size="sm" onClick={() => setCurrentStep(currentStep - 1)} {...props}>
      {children ?? t('Back')}
    </Button>
  );
}

function NextButton({children, ...props}: BaseButtonProps) {
  const {currentStep, setCurrentStep, totalSteps} = useGuidedStepsContext();

  if (currentStep >= totalSteps) {
    return null;
  }

  return (
    <Button size="sm" onClick={() => setCurrentStep(currentStep + 1)} {...props}>
      {children ?? t('Next')}
    </Button>
  );
}

function StepButtons({children}: {children?: React.ReactNode}) {
  return (
    <StepButtonsWrapper>
      <BackButton />
      <NextButton />
      {children}
    </StepButtonsWrapper>
  );
}

export function GuidedSteps({className, children, onStepChange}: GuidedStepsProps) {
  const value = useGuidedStepsContentValue({onStepChange});

  return (
    <GuidedStepsContext.Provider value={value}>
      <StepsWrapper className={className}>{children}</StepsWrapper>
    </GuidedStepsContext.Provider>
  );
}

const StepButtonsWrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1)};
  margin-top: ${space(1.5)};
`;

const StepsWrapper = styled('div')`
  background: ${p => p.theme.background};
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const StepWrapper = styled('div')`
  display: grid;
  grid-template-columns: 34px 1fr;
  gap: ${space(1.5)};
  position: relative;

  :not(:last-child)::before {
    content: '';
    position: absolute;
    height: calc(100% + ${space(2)});
    width: 1px;
    background: ${p => p.theme.border};
    left: 17px;
  }
`;

const StepNumber = styled('div')<{isActive: boolean}>`
  position: relative;
  z-index: 2;
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  width: 34px;
  line-height: 34px;
  border-radius: 50%;
  background: ${p => (p.isActive ? p.theme.purple300 : p.theme.gray100)};
  color: ${p => (p.isActive ? p.theme.white : p.theme.subText)};
  border: 4px solid ${p => p.theme.background};
`;

const StepHeading = styled('h4')<{isActive: boolean}>`
  line-height: 34px;
  margin: 0;
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => (p.isActive ? p.theme.textColor : p.theme.subText)};
`;

const StepDoneIcon = styled(IconCheckmark, {
  shouldForwardProp: prop => prop !== 'isActive',
})<{isActive: boolean}>`
  color: ${p => (p.isActive ? p.theme.successText : p.theme.subText)};
  margin-left: ${space(1)};
  vertical-align: middle;
`;

const ChildrenWrapper = styled('div')<{isActive: boolean}>`
  color: ${p => (p.isActive ? p.theme.textColor : p.theme.subText)};

  p {
    margin-bottom: ${space(1)};
  }
`;

const StepDetails = styled('div')`
  overflow: hidden;
`;

GuidedSteps.Step = Step;
GuidedSteps.BackButton = BackButton;
GuidedSteps.NextButton = NextButton;
GuidedSteps.StepButtons = StepButtons;
GuidedSteps.ButtonWrapper = StepButtonsWrapper;
