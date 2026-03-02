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

import type {ButtonProps} from '@sentry/scraps/button';
import {Button} from '@sentry/scraps/button';
import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Flex, Stack} from '@sentry/scraps/layout';

import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import usePrevious from 'sentry/utils/usePrevious';

type GuidedStepsProps = {
  children: React.ReactNode;
  className?: string;
  initialStep?: number;
  onStepChange?: (step: number) => void;
};

interface GuidedStepsContextState {
  advanceToNextIncompleteStep: () => void;
  currentStep: number;
  getStepNumber: (stepKey: string) => number;
  registerStep: (step: RegisterStepInfo) => void;
  setCurrentStep: (step: number) => void;
  totalSteps: number;
}

interface StepProps {
  children: React.ReactNode;
  stepKey: string;
  title: React.ReactNode;
  isCompleted?: boolean;
  onClick?: () => void;
  optional?: boolean;
  trailingItems?: React.ReactNode;
}

type RegisterStepInfo = Pick<StepProps, 'stepKey' | 'isCompleted'>;
type RegisteredSteps = Record<string, {stepNumber: number; isCompleted?: boolean}>;

const GuidedStepsContext = createContext<GuidedStepsContextState>({
  advanceToNextIncompleteStep: () => {},
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
  initialStep,
  onStepChange,
}: Pick<GuidedStepsProps, 'onStepChange' | 'initialStep'>): GuidedStepsContextState {
  const registeredStepsRef = useRef<RegisteredSteps>({});
  const [totalSteps, setTotalSteps] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState<number>(initialStep ?? 1);

  // Steps are registered on initial render to determine the step order and which step to start on.
  // This allows Steps to be wrapped in other components, but does require that they exist on first
  // render and that step order does not change.
  const registerStep = useCallback((props: RegisterStepInfo) => {
    if (registeredStepsRef.current[props.stepKey]) {
      registeredStepsRef.current[props.stepKey]!.isCompleted = props.isCompleted;
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

  const getFirstIncompleteStep = useCallback(() => {
    return orderBy(Object.values(registeredStepsRef.current), 'stepNumber').find(
      step => step.isCompleted !== true
    );
  }, []);

  const advanceToNextIncompleteStep = useCallback(() => {
    const firstIncompleteStep = getFirstIncompleteStep();
    if (firstIncompleteStep) {
      setCurrentStep(firstIncompleteStep.stepNumber);
    }
  }, [getFirstIncompleteStep]);

  // On initial load, set the current step to the first incomplete step
  // if the initial step is not defined.
  useEffect(() => {
    if (defined(initialStep)) {
      return;
    }
    const firstIncompleteStep = getFirstIncompleteStep();
    setCurrentStep(firstIncompleteStep?.stepNumber ?? 1);
  }, [getFirstIncompleteStep, initialStep]);

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
      advanceToNextIncompleteStep,
    }),
    [
      advanceToNextIncompleteStep,
      currentStep,
      getStepNumber,
      handleSetCurrentStep,
      registerStep,
      totalSteps,
    ]
  );
}

function Step(props: StepProps) {
  const {advanceToNextIncompleteStep, currentStep, registerStep, getStepNumber} =
    useGuidedStepsContext();
  const stepNumber = getStepNumber(props.stepKey);
  const isActive = currentStep === stepNumber;
  const isCompleted = props.isCompleted ?? currentStep > stepNumber;
  const previousIsCompleted = usePrevious(isCompleted);

  useEffect(() => {
    registerStep({isCompleted: props.isCompleted, stepKey: props.stepKey});
  }, [props.isCompleted, props.stepKey, registerStep]);

  useEffect(() => {
    if (!previousIsCompleted && isCompleted && isActive) {
      advanceToNextIncompleteStep();
    }
  }, [advanceToNextIncompleteStep, isActive, isCompleted, previousIsCompleted]);

  const headingContent = (
    <StepButton
      hasTrailingItems={!!props.trailingItems}
      disabled={!props.onClick}
      onClick={props.onClick}
    >
      <Flex align="center" gap="lg">
        <StepNumber isActive={isActive}>{stepNumber}</StepNumber>
        <StepHeading isActive={isActive}>
          {props.title}
          {isCompleted && <StepDoneIcon isActive={isActive} size="sm" />}
        </StepHeading>
        {props.onClick ? <InteractionStateLayer /> : null}
      </Flex>
    </StepButton>
  );

  return (
    <StepWrapper data-test-id={`guided-step-${stepNumber}`}>
      {props.trailingItems ? (
        <Flex
          direction={{xs: 'column', md: 'row'}}
          align={{xs: 'start', md: 'center'}}
          paddingLeft={{xs: 'lg', md: '0'}}
          justify="between"
          gap="sm"
          area="heading"
        >
          {headingContent}
          <Flex align="center" onClick={e => e.stopPropagation()}>
            {props.trailingItems}
          </Flex>
        </Flex>
      ) : (
        headingContent
      )}

      <StepDetails>
        {props.optional ? <StepOptionalLabel>Optional</StepOptionalLabel> : null}
        {isActive && (
          <ChildrenWrapper isActive={isActive}>{props.children}</ChildrenWrapper>
        )}
      </StepDetails>
    </StepWrapper>
  );
}

function BackButton(props: Partial<ButtonProps>) {
  const {currentStep, setCurrentStep} = useGuidedStepsContext();

  if (currentStep === 1) {
    return null;
  }

  return (
    <Button size="sm" onClick={() => setCurrentStep(currentStep - 1)} {...props}>
      {t('Back')}
    </Button>
  );
}

function NextButton(props: Partial<ButtonProps>) {
  const {currentStep, setCurrentStep, totalSteps} = useGuidedStepsContext();

  if (currentStep >= totalSteps) {
    return null;
  }

  return (
    <Button size="sm" onClick={() => setCurrentStep(currentStep + 1)} {...props}>
      {t('Next')}
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

export function GuidedSteps({
  className,
  children,
  onStepChange,
  initialStep,
}: GuidedStepsProps) {
  const value = useGuidedStepsContentValue({onStepChange, initialStep});

  return (
    <GuidedStepsContext value={value}>
      <Stack gap="xl" background="primary" className={className}>
        {children}
      </Stack>
    </GuidedStepsContext>
  );
}

const StepButtonsWrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${p => p.theme.space.md};
  margin-top: ${p => p.theme.space.lg};
`;

const StepWrapper = styled('div')`
  display: grid;
  grid-template-areas: 'heading heading' '. details';
  grid-template-columns: 34px 1fr;
  gap: 0 ${p => p.theme.space.lg};
  position: relative;

  :not(:last-child)::before {
    content: '';
    position: absolute;
    height: calc(100% + ${p => p.theme.space.xl});
    width: 1px;
    /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
    background: ${p => p.theme.tokens.border.primary};
    left: 17px;
  }
`;

const StepButton = styled('button')<{hasTrailingItems: boolean}>`
  ${p =>
    p.hasTrailingItems
      ? `flex: 1; min-width: 0; text-align: left;`
      : `grid-area: heading;`}

  position: relative;
  background: none;
  border: none;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  margin: -${p => p.theme.space.sm} -${p => p.theme.space.md};
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;
`;

const StepNumber = styled('div')<{isActive: boolean}>`
  position: relative;
  z-index: 2;
  font-size: ${p => p.theme.font.size.lg};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  display: flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  width: 34px;
  line-height: 34px;
  border-radius: 50%;
  background: ${p =>
    p.isActive
      ? p.theme.tokens.graphics.accent.vibrant
      : p.theme.tokens.graphics.neutral.moderate};
  color: ${p => p.theme.colors.white};
  border: 4px solid ${p => p.theme.tokens.border.primary};
`;

const StepHeading = styled('h4')<{isActive: boolean}>`
  line-height: 34px;
  margin: 0;
  font-weight: ${p => p.theme.font.weight.sans.medium};
  font-size: ${p => p.theme.font.size.lg};
  color: ${p =>
    p.isActive ? p.theme.tokens.content.primary : p.theme.tokens.content.secondary};

  position: relative;
  border: none;
  background: none;
  border-radius: ${p => p.theme.radius.md};
`;

const StepDoneIcon = styled(IconCheckmark, {
  shouldForwardProp: prop => prop !== 'isActive',
})<{isActive: boolean}>`
  color: ${p =>
    p.isActive ? p.theme.tokens.content.success : p.theme.tokens.content.secondary};
  margin-left: ${p => p.theme.space.md};
  vertical-align: middle;
`;

const StepOptionalLabel = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
  margin-top: -${p => p.theme.space.sm};
  margin-bottom: ${p => p.theme.space.md};
`;

const ChildrenWrapper = styled('div')<{isActive: boolean}>`
  color: ${p =>
    p.isActive ? p.theme.tokens.content.primary : p.theme.tokens.content.secondary};

  p {
    margin-bottom: ${p => p.theme.space.md};
  }
`;

const StepDetails = styled('div')`
  overflow: hidden;
  grid-area: details;
`;

GuidedSteps.Step = Step;
GuidedSteps.BackButton = BackButton;
GuidedSteps.NextButton = NextButton;
GuidedSteps.StepButtons = StepButtons;
GuidedSteps.ButtonWrapper = StepButtonsWrapper;
