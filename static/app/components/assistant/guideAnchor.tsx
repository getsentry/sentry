import {useCallback, useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {
  closeGuide,
  dismissGuide,
  nextStep,
  recordFinish,
  registerAnchor,
  unregisterAnchor,
} from 'sentry/actionCreators/guides';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import type {Hovercard} from 'sentry/components/hovercard';
import {TourAction, TourGuide} from 'sentry/components/tours/components';
import {t} from 'sentry/locale';
import GuideStore from 'sentry/stores/guideStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

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

function BaseGuideAnchor({
  target,
  children,
  position,
  offset,
  containerClassName,
  onFinish,
  onStepComplete,
}: Props) {
  const {currentGuide, currentStep: step, orgId, forceHide} = useLegacyStore(GuideStore);

  useEffect(() => {
    registerAnchor(target);
    return () => {
      unregisterAnchor(target);
    };
  }, [target]);

  const active = currentGuide?.steps[step]?.target === target && !forceHide;

  const handleFinish = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onStepComplete?.(e);
      onFinish?.(e);

      if (currentGuide) {
        recordFinish(currentGuide.guide, orgId);
      }
      closeGuide();
    },
    [currentGuide, onFinish, onStepComplete, orgId]
  );

  const handleNextStep = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onStepComplete?.(e);
      nextStep();
    },
    [onStepComplete]
  );

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (currentGuide) {
        dismissGuide(currentGuide.guide, step, orgId);
      }
    },
    [currentGuide, orgId, step]
  );

  if (!active) {
    return children ? children : null;
  }

  const totalStepCount = currentGuide?.steps.length ?? 0;
  const currentStepCount = step + 1;
  const currentStep = currentGuide?.steps[step]!;
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
        handleDismiss(e);
        window.location.hash = '';
      }}
      wrapperComponent={GuideAnchorWrapper}
      actions={
        <ButtonBar>
          {lastStep ? (
            <TourAction size="xs" onClick={handleFinish}>
              {currentStep.nextText || (hasManySteps ? t('Enough Already') : t('Got It'))}
            </TourAction>
          ) : (
            <TourAction size="xs" onClick={handleNextStep}>
              {currentStep.nextText || t('Next')}
            </TourAction>
          )}
        </ButtonBar>
      }
      className={containerClassName}
      position={position}
      offset={offset}
    >
      <ScrollToGuide>{children}</ScrollToGuide>
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
function GuideAnchor({disabled, children, ...rest}: WrapperProps) {
  if (disabled) {
    return children;
  }
  return <BaseGuideAnchor {...rest}>{children}</BaseGuideAnchor>;
}

const GuideAnchorWrapper = styled('span')`
  display: inline-block;
  max-width: 100%;
`;

export default GuideAnchor;
