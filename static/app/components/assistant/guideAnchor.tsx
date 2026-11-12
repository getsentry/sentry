import {useCallback, useEffect, useRef} from 'react';
import * as Sentry from '@sentry/react';
import {useStore} from 'zustand';
import {useShallow} from 'zustand/react/shallow';

import {Container, Grid} from '@sentry/scraps/layout';

import {
  closeGuide,
  dismissGuide,
  nextStep,
  recordFinish,
  registerAnchor,
  unregisterAnchor,
} from 'sentry/actionCreators/guides';
import type {Hovercard} from 'sentry/components/hovercard';
import {TourAction, TourGuide} from 'sentry/components/tours/components';
import {t} from 'sentry/locale';
import {getActiveGuideStep, GuideStore} from 'sentry/stores/guideStore';

import type {GuideStep} from './types';

interface Props {
  target: string;
  children?: React.ReactNode;
  /**
   * Hovercard renders the container
   */
  containerClassName?: string;
  offset?: number;
  /**
   * Trigger when the guide is completed (all steps have been clicked through)
   */
  onFinish?: (e: React.MouseEvent) => void;
  /**
   * Triggered when any step is completed (including the last step)
   */
  onStepComplete?: (e: React.MouseEvent) => void;
  position?: React.ComponentProps<typeof Hovercard>['position'];
}

function ScrollToGuide({children}: {children: React.ReactNode}) {
  const containerElement = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (containerElement.current) {
      try {
        const {top} = containerElement.current.getBoundingClientRect();
        const scrollTop = window.pageYOffset;
        const centerElement = top + scrollTop - window.innerHeight / 2;
        window.scrollTo({top: centerElement});
      } catch (err) {
        Sentry.captureException(err);
      }
    }
  }, [containerElement]);

  return <span ref={containerElement}>{children}</span>;
}

function BaseGuideAnchor({children, target, ...props}: Props) {
  // Only the anchor that's showing a step re-renders when the guide changes.
  const activeStep = useStore(GuideStore, state => getActiveGuideStep(state, target));

  useEffect(() => {
    registerAnchor(target);
    return () => {
      unregisterAnchor(target);
    };
  }, [target]);

  if (!activeStep) {
    return children ? children : null;
  }

  return (
    <ActiveGuideAnchor step={activeStep} {...props}>
      {children}
    </ActiveGuideAnchor>
  );
}

interface ActiveGuideAnchorProps extends Omit<Props, 'target'> {
  step: GuideStep;
}

function ActiveGuideAnchor({
  step: currentStep,
  children,
  position,
  offset,
  containerClassName,
  onFinish,
  onStepComplete,
}: ActiveGuideAnchorProps) {
  const {step, totalStepCount} = useStore(
    GuideStore,
    useShallow(state => ({
      step: state.currentStep,
      totalStepCount: state.currentGuide?.steps.length ?? 0,
    }))
  );

  /**
   * Terminology:
   *
   *  - A guide can be FINISHED by clicking one of the buttons in the last step
   *  - A guide can be DISMISSED by x-ing out of it at any step except the last (where there is no x)
   *  - In both cases we consider it CLOSED
   */
  const handleFinish = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onStepComplete?.(e);
      onFinish?.(e);

      const {currentGuide, orgId} = GuideStore.getState();
      if (currentGuide) {
        recordFinish(currentGuide.guide, orgId);
      }
      closeGuide();
    },
    [onFinish, onStepComplete]
  );

  const handleNextStep = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onStepComplete?.(e);
      nextStep();
    },
    [onStepComplete]
  );

  const currentStepCount = step + 1;
  const lastStep = currentStepCount === totalStepCount && !currentStep.hasNextGuide;
  const hasManySteps = totalStepCount > 1;

  return (
    <TourGuide
      isOpen
      title={currentStep.title}
      description={currentStep.description}
      stepCount={currentStepCount}
      stepTotal={totalStepCount}
      handleDismiss={e => {
        e.stopPropagation();
        const {currentGuide, orgId} = GuideStore.getState();
        if (currentGuide) {
          dismissGuide(currentGuide.guide, step, orgId);
        }
        window.location.hash = '';
      }}
      actions={
        <Grid flow="column" align="center" gap="md">
          {lastStep ? (
            <TourAction size="xs" onClick={handleFinish}>
              {currentStep.nextText || (hasManySteps ? t('Enough Already') : t('Got It'))}
            </TourAction>
          ) : (
            <TourAction size="xs" onClick={handleNextStep}>
              {currentStep.nextText || t('Next')}
            </TourAction>
          )}
        </Grid>
      }
      className={containerClassName}
      position={position}
      offset={offset}
    >
      {tourProps => (
        <Container as="span" maxWidth="100%" display="inline-block" {...tourProps}>
          <ScrollToGuide>{children}</ScrollToGuide>
        </Container>
      )}
    </TourGuide>
  );
}

/**
 * Wraps the GuideAnchor so we don't have to render it if it's disabled
 * Using a class so we automatically have children as a typed prop
 */
interface WrapperProps extends Props {
  disabled?: boolean;
}

/**
 * A GuideAnchor puts an informative hovercard around an element. Guide anchors
 * register with the GuideStore, which uses registrations from one or more
 * anchors on the page to determine which guides can be shown on the page.
 */
export function GuideAnchor({disabled, children, ...rest}: WrapperProps) {
  if (disabled) {
    return children;
  }
  return <BaseGuideAnchor {...rest}>{children}</BaseGuideAnchor>;
}
