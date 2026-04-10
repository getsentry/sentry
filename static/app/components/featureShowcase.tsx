import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

import {Button} from '@sentry/scraps/button';
import {Image, type ImageProps} from '@sentry/scraps/image';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';

type ShowcaseContextValue = {
  advance: () => void;
  back: () => void;
  close: () => void;
  current: number;
  hasNext: boolean;
  hasPrevious: boolean;
  stepCount: number;
};

const ShowcaseContext = createContext<ShowcaseContextValue | null>(null);

function useShowcaseContext(): ShowcaseContextValue {
  const ctx = useContext(ShowcaseContext);
  if (!ctx) {
    throw new Error(
      'FeatureShowcase compound components must be used within FeatureShowcase'
    );
  }
  return ctx;
}

function Step({children}: {children: ReactNode}) {
  return <Stack gap="md">{children}</Stack>;
}

function StepImage(props: ImageProps) {
  return <Image height="200px" objectFit="contain" {...props} />;
}

function StepTitle({children}: {children: ReactNode}) {
  const {current, stepCount} = useShowcaseContext();
  return (
    <Stack gap="md">
      <Text size="sm" variant="muted">
        {`${current + 1} / ${stepCount}`}
      </Text>
      <Heading as="h4" size="lg">
        {children}
      </Heading>
    </Stack>
  );
}

function StepContent({children}: {children: ReactNode}) {
  return <Text as="p">{children}</Text>;
}

/**
 * Renders the navigation footer for a step.
 *
 * - No children: renders default Back/Next/Done buttons.
 * - With children: rendered alongside the default navigation buttons.
 */
function StepActions({children}: {children?: ReactNode}) {
  const {advance, back, close, hasNext, hasPrevious} = useShowcaseContext();

  return (
    <Flex justify="end" gap="md">
      {children}
      {hasPrevious && <Button onClick={back}>{t('Back')}</Button>}
      {hasNext ? (
        <Button priority="primary" onClick={advance}>
          {t('Next')}
        </Button>
      ) : (
        <Button priority="primary" onClick={close} aria-label={t('Complete tour')}>
          {t('Done')}
        </Button>
      )}
    </Flex>
  );
}

type FeatureShowcaseProps = ModalRenderProps & {
  children: ReactNode;
  /**
   * Called when the showcase advances to a new step.
   */
  onStepChange?: (step: number) => void;
};

/**
 * A multi-step feature showcase modal. Render inside `openModal`.
 *
 * @example
 * ```tsx
 * openModal(deps => (
 *   <FeatureShowcase {...deps} onStepChange={handleStep} onClose={handleClose}>
 *     <FeatureShowcase.Step>
 *       <FeatureShowcase.Image src={heroImage} alt="Step 1" />
 *       <FeatureShowcase.StepTitle>Step 1</FeatureShowcase.StepTitle>
 *       <FeatureShowcase.StepContent>Content here</FeatureShowcase.StepContent>
 *       <FeatureShowcase.StepActions />
 *     </FeatureShowcase.Step>
 *     <FeatureShowcase.Step>
 *       <FeatureShowcase.StepTitle>Step 2</FeatureShowcase.StepTitle>
 *       <FeatureShowcase.StepContent>More content</FeatureShowcase.StepContent>
 *       <FeatureShowcase.StepActions>
 *         <Button onClick={...}>Extra</Button>
 *       </FeatureShowcase.StepActions>
 *     </FeatureShowcase.Step>
 *   </FeatureShowcase>
 * ));
 * ```
 */
function FeatureShowcase({closeModal, children, onStepChange}: FeatureShowcaseProps) {
  const [current, setCurrent] = useState(0);

  const steps = Children.toArray(children).filter(
    (child): child is ReactElement => isValidElement(child) && child.type === Step
  );

  const stepCount = steps.length;
  const hasNext = current < stepCount - 1;
  const hasPrevious = current > 0;
  const activeStep = steps[current] ?? steps[stepCount - 1];

  const handleAdvance = () => {
    const nextStep = Math.min(current + 1, stepCount - 1);
    if (nextStep !== current) {
      setCurrent(nextStep);
      onStepChange?.(nextStep);
    }
  };

  const handleBack = () => {
    const prevStep = Math.max(current - 1, 0);
    if (prevStep !== current) {
      setCurrent(prevStep);
      onStepChange?.(prevStep);
    }
  };

  const contextValue: ShowcaseContextValue = {
    current,
    stepCount,
    hasNext,
    hasPrevious,
    advance: handleAdvance,
    back: handleBack,
    close: closeModal,
  };

  return (
    <Container data-test-id="feature-showcase">
      <Flex justify="end">
        <Button priority="transparent" onClick={closeModal} aria-label={t('Close tour')}>
          <IconClose size="xs" />
        </Button>
      </Flex>
      <ShowcaseContext.Provider value={contextValue}>
        {activeStep}
      </ShowcaseContext.Provider>
    </Container>
  );
}

FeatureShowcase.Step = Step;
FeatureShowcase.Image = StepImage;
FeatureShowcase.StepTitle = StepTitle;
FeatureShowcase.StepContent = StepContent;
FeatureShowcase.StepActions = StepActions;

export {FeatureShowcase, useShowcaseContext};
