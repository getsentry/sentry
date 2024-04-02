import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import styled from '@emotion/styled';

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
  setCurrentStep: (step: number) => void;
  totalSteps: number;
}

interface StepProps {
  children: React.ReactNode;
  title: string;
  isCompleted?: boolean;
  stepNumber?: number;
}

const GuidedStepsContext = createContext<GuidedStepsContextState>({
  currentStep: 0,
  setCurrentStep: () => {},
  totalSteps: 0,
});

export function useGuidedStepsContext() {
  return useContext(GuidedStepsContext);
}

function Step({
  stepNumber = 1,
  title,
  children,
  isCompleted: completedOverride,
}: StepProps) {
  const {currentStep} = useGuidedStepsContext();
  const isActive = currentStep === stepNumber;
  const isCompleted = completedOverride ?? currentStep > stepNumber;

  return (
    <StepWrapper data-test-id={`guided-step-${stepNumber}`}>
      <StepNumber isActive={isActive}>{stepNumber}</StepNumber>
      <div>
        <StepHeading isActive={isActive}>
          {title}
          {isCompleted && <StepDoneIcon isActive={isActive} size="sm" />}
        </StepHeading>
        {isActive && <ChildrenWrapper isActive={isActive}>{children}</ChildrenWrapper>}
      </div>
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

function StepButtons() {
  return (
    <StepButtonsWrapper>
      <BackButton />
      <NextButton />
    </StepButtonsWrapper>
  );
}

export function GuidedSteps({className, children, onStepChange}: GuidedStepsProps) {
  const [currentStep, setCurrentStep] = useState<number>(() => {
    // If `isCompleted` has been passed in, we should start at the first incomplete step
    const firstIncompleteStepIndex = Children.toArray(children).findIndex(child =>
      isValidElement(child) ? child.props.isCompleted !== true : false
    );

    return Math.max(1, firstIncompleteStepIndex + 1);
  });

  const totalSteps = Children.count(children);
  const handleSetCurrentStep = useCallback(
    (step: number) => {
      setCurrentStep(step);
      onStepChange?.(step);
    },
    [onStepChange]
  );

  const value = useMemo(
    () => ({
      currentStep,
      setCurrentStep: handleSetCurrentStep,
      totalSteps,
    }),
    [currentStep, handleSetCurrentStep, totalSteps]
  );

  return (
    <GuidedStepsContext.Provider value={value}>
      <StepsWrapper className={className}>
        {Children.map(children, (child, index) => {
          if (!child) {
            return null;
          }

          return <Step stepNumber={index + 1} {...child.props} />;
        })}
      </StepsWrapper>
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
`;

GuidedSteps.Step = Step;
GuidedSteps.BackButton = BackButton;
GuidedSteps.NextButton = NextButton;
GuidedSteps.StepButtons = StepButtons;
GuidedSteps.ButtonWrapper = StepButtonsWrapper;
