import type {CSSProperties, HTMLAttributes} from 'react';
import {Fragment, useContext, useEffect, useMemo} from 'react';
import {createPortal} from 'react-dom';
import {ClassNames, ThemeProvider, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {
  useTourReducer,
  type TourContextType,
  type TourEnumType,
  type TourState,
  type TourStep,
} from 'sentry/components/tours/tourContext';
import {useMutateAssistant} from 'sentry/components/tours/useAssistant';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useInvertedTheme} from 'sentry/utils/theme/useInvertedTheme';
import {useEffectAfterFirstRender} from 'sentry/utils/useEffectAfterFirstRender';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import useOrganization from 'sentry/utils/useOrganization';
import useOverlay, {type UseOverlayProps} from 'sentry/utils/useOverlay';

export interface TourContextProviderProps<T extends TourEnumType> {
  /**
   * The React context (from React.createContext) containing the provider for the tour.
   */
  TourContext: React.Context<TourContextType<T> | null>;
  /**
   * The children of the tour context provider.
   * All children of this component will be blurred when the tour is active.
   * Only the active tour element and overlay will be discernible.
   */
  children: React.ReactNode;
  /**
   * Whether the tour has been completed.
   */
  isCompleted: TourState<T>['isCompleted'];
  /**
   * The ordered list of Step IDs
   */
  orderedStepIds: TourState<T>['orderedStepIds'];
  /**
   * Whether to omit the blurring window.
   */
  omitBlur?: boolean;
  /**
   * Called when the tour is ended by the user, either by dismissing the tour or by completing the last step.
   */
  onEndTour?: () => void;
  /**
   * Called when the tour is started.
   */
  onStartTour?: (stepId?: T) => void;
  /**
   * Called when the tour step changes.
   */
  onStepChange?: (stepId: T) => void;
  /**
   * Whether to require all steps to be registered in the DOM before the tour can start.
   */
  requireAllStepsRegistered?: boolean;
  /**
   * The assistant guide key of the tour. Should be declared in `src/sentry/assistant/guides.py`.
   */
  tourKey?: string;
}

export function TourContextProvider<T extends TourEnumType>({
  children,
  isCompleted,
  tourKey,
  TourContext,
  omitBlur,
  orderedStepIds,
  onEndTour,
  onStartTour,
  onStepChange,
  requireAllStepsRegistered,
}: TourContextProviderProps<T>) {
  const organization = useOrganization();
  const {mutate} = useMutateAssistant();
  const options = useMemo(
    () => ({
      onStartTour,
      onEndTour,
      onStepChange,
      requireAllStepsRegistered,
    }),
    [onStartTour, onEndTour, onStepChange, requireAllStepsRegistered]
  );
  const tourContextValue = useTourReducer<T>(
    {
      isCompleted,
      isRegistered: false,
      orderedStepIds,
      currentStepId: null,
      tourKey,
    },
    options
  );
  const {endTour, previousStep, nextStep, currentStepId} = tourContextValue;
  const isTourActive = currentStepId !== null;

  useHotkeys(
    isTourActive
      ? [
          {
            match: 'Escape',
            callback: () => {
              if (tourKey) {
                mutate({guide: tourKey, status: 'dismissed'});
              }
              trackAnalytics('tour-guide.dismiss', {
                organization,
                id: `${currentStepId}`,
              });
              endTour();
            },
          },
          {match: ['left', 'h'], callback: () => previousStep()},
          {match: ['right', 'l'], callback: () => nextStep()},
        ]
      : []
  );

  useEffect(() => {
    if (isTourActive && tourKey) {
      mutate({guide: tourKey, status: 'viewed'});
    }
  }, [isTourActive, mutate, tourKey]);

  return (
    <TourContext value={tourContextValue}>
      {isTourActive && !omitBlur && <BlurWindow data-test-id="tour-blur-window" />}
      {children}
    </TourContext>
  );
}

export interface TourElementProps<T extends TourEnumType>
  extends Omit<HTMLAttributes<HTMLElement>, 'id' | 'title'> {
  /**
   * The content being focused during the tour.
   */
  children: React.ReactNode;
  /**
   * The description of the tour step.
   * If null, a tooltip will not be displayed. This is useful if there are multiple
   * elements you want to focus on in a single step.
   */
  description: React.ReactNode;
  /**
   * The unique identifier of the tour step.
   */
  id: TourStep<T>['id'];
  /**
   * The title of the tour step.
   * If null, a tooltip will not be displayed. This is useful if there are multiple
   * elements you want to focus on in a single step.
   */
  title: React.ReactNode;
  /**
   * The React context (from React.createContext) containing the provider for the tour.
   */
  tourContext: React.Context<TourContextType<T> | null>;
  /**
   * The actions to display in the tour element.
   */
  actions?: React.ReactNode;
  /**
   * A margin to create between the tour element and the border.
   */
  margin?: number;
  /**
   * The position of the tour element.
   */
  position?: UseOverlayProps['position'];
}

export function TourElement<T extends TourEnumType>({
  children,
  tourContext,
  ...props
}: TourElementProps<T>) {
  const tourContextValue = useContext(tourContext);
  if (!tourContextValue) {
    return children;
  }
  return (
    <TourElementContent {...props} tourContextValue={tourContextValue}>
      {children}
    </TourElementContent>
  );
}

interface TourElementContentProps<T extends TourEnumType>
  extends Omit<TourElementProps<T>, 'tourContext'> {
  tourContextValue: TourContextType<T>;
}

export function TourElementContent<T extends TourEnumType>({
  children,
  id,
  title,
  description,
  tourContextValue,
  position,
  className,
  actions,
  margin,
}: TourElementContentProps<T>) {
  const organization = useOrganization();
  const {
    currentStepId,
    orderedStepIds,
    handleStepRegistration,
    tourKey,
    previousStep,
    nextStep,
    endTour,
  } = tourContextValue;
  const stepCount = currentStepId ? orderedStepIds.indexOf(id) + 1 : 0;
  const stepTotal = orderedStepIds.length;
  const hasPreviousStep = stepCount > 1;
  const hasNextStep = stepCount < stepTotal;
  const isOpen = currentStepId === id;
  const {mutate} = useMutateAssistant();
  useEffect(() => handleStepRegistration({id}), [id, handleStepRegistration]);

  useEffect(() => {
    if (isOpen) {
      trackAnalytics('tour-guide.open', {
        organization,
        id: id.toString(),
        tour_key: tourKey,
        step_count: stepCount,
      });
    }
  }, [isOpen, id, organization, tourKey, stepCount]);

  const defaultActions = useMemo(
    () => (
      <ButtonBar>
        {hasPreviousStep && (
          <TextTourAction size="xs" onClick={previousStep}>
            {t('Previous')}
          </TextTourAction>
        )}
        {hasNextStep ? (
          <TourAction size="xs" onClick={nextStep}>
            {t('Next')}
          </TourAction>
        ) : (
          <TourAction
            size="xs"
            onClick={() => {
              endTour();
              trackAnalytics('tour-guide.finish', {
                organization,
                id: id.toString(),
                step_count: stepCount,
                tour_key: tourKey,
              });
            }}
          >
            {t('Finish tour')}
          </TourAction>
        )}
      </ButtonBar>
    ),
    [
      hasPreviousStep,
      hasNextStep,
      previousStep,
      nextStep,
      endTour,
      organization,
      id,
      stepCount,
      tourKey,
    ]
  );

  return (
    <TourGuide
      title={title}
      description={description}
      actions={defined(actions) ? actions : defaultActions}
      className={className}
      isOpen={isOpen}
      position={position}
      handleDismiss={() => {
        if (tourKey) {
          mutate({guide: tourKey, status: 'dismissed'});
          trackAnalytics('tour-guide.dismiss', {
            organization,
            id: id.toString(),
            step_count: stepCount,
            tour_key: tourKey,
          });
        }
        endTour();
      }}
      stepCount={stepCount}
      stepTotal={stepTotal}
      id={`${id}`}
      margin={margin}
    >
      {children}
    </TourGuide>
  );
}

interface TourGuideProps extends Omit<HTMLAttributes<HTMLElement>, 'title' | 'id'> {
  children: React.ReactNode;
  description: React.ReactNode;
  isOpen: UseOverlayProps['isOpen'];
  /**
   * The <TourGuide /> component is very opinionated on styles. It uses a black background on light
   * mode and purple on dark mode. For best results, use `<TourAction />` and `<TourTextAction/>`
   * instead of regular buttons, since it may cause readibility issues if we use the user's theme.
   */
  actions?: React.ReactNode;
  handleDismiss?: (e: React.MouseEvent) => void;
  id?: string;
  margin?: CSSProperties['margin'];
  offset?: UseOverlayProps['offset'];
  position?: UseOverlayProps['position'];
  stepCount?: number;
  stepTotal?: number;
  title?: React.ReactNode;
  wrapperComponent?: React.ComponentType<{
    'aria-expanded': React.AriaAttributes['aria-expanded'];
    children: React.ReactNode;
    ref: React.RefAttributes<HTMLElement>['ref'];
  }>;
}

export function TourGuide({
  children,
  title,
  description,
  actions,
  className,
  isOpen,
  position,
  handleDismiss,
  stepCount,
  wrapperComponent,
  stepTotal,
  offset,
  margin,
}: TourGuideProps) {
  const theme = useTheme();
  const invertedTheme = useInvertedTheme();

  const isStepCountVisible = defined(stepCount) && defined(stepTotal) && stepTotal !== 1;
  const isDismissVisible = defined(handleDismiss);
  const isTopRowVisible = isStepCountVisible || isDismissVisible;
  const countText = isStepCountVisible ? `${stepCount}/${stepTotal}` : '';
  const {triggerProps, overlayProps, arrowProps, update} = useOverlay({
    shouldApplyMinWidth: false,
    isOpen,
    position,
    offset,
  });

  const Wrapper = wrapperComponent ?? TourTriggerWrapper;

  // Update the overlay positioning when the content changes
  useEffectAfterFirstRender(() => {
    if (isOpen && update && defined(title) && defined(description)) {
      update();
    }
  }, [isOpen, update, title, description]);

  return (
    <Fragment>
      <Wrapper
        className={className}
        ref={triggerProps.ref}
        aria-expanded={triggerProps['aria-expanded']}
        margin={`${margin}px`}
      >
        {children}
      </Wrapper>
      {isOpen && defined(title) && defined(description)
        ? createPortal(
            <PositionWrapper zIndex={theme.zIndex.tour.overlay} {...overlayProps}>
              <ThemeProvider theme={invertedTheme}>
                <ClassNames>
                  {({css, theme: currentTheme}) => (
                    <TourOverlay
                      animated
                      arrowProps={{
                        ...arrowProps,
                        strokeWidth: 0,
                        className: css`
                          path.fill {
                            fill: ${currentTheme.tokens.background.primary};
                          }
                          path.stroke {
                            stroke: transparent;
                          }
                        `,
                      }}
                    >
                      <TourBody ref={scrollToElement}>
                        {isTopRowVisible && (
                          <TopRow>
                            <div>{countText}</div>
                            {isDismissVisible && (
                              <Button
                                priority="transparent"
                                borderless
                                onClick={handleDismiss}
                                icon={<IconClose />}
                                aria-label={t('Close')}
                                size="zero"
                              />
                            )}
                          </TopRow>
                        )}
                        {title && <TitleRow>{title}</TitleRow>}
                        {description && <DescriptionRow>{description}</DescriptionRow>}
                        {actions && (
                          <Flex justify="end" marginTop="md">
                            {actions}
                          </Flex>
                        )}
                      </TourBody>
                    </TourOverlay>
                  )}
                </ClassNames>
              </ThemeProvider>
            </PositionWrapper>,
            document.body
          )
        : null}
    </Fragment>
  );
}

function scrollToElement(element: HTMLDivElement | null) {
  element?.scrollIntoView?.({block: 'center', behavior: 'smooth'});
}

/* XXX: For compatibility with Guides, we need to style 'a' tags which are often docs links */
const TourBody = styled('div')`
  display: flex;
  flex-direction: column;
  background: ${p => p.theme.tokens.background.primary};
  padding: ${space(1.5)} ${space(2)};
  color: ${p => p.theme.tokens.content.primary};
  border-radius: ${p => p.theme.radius.md};
  width: 360px;
  a {
    color: ${p => p.theme.tokens.content.primary};
    text-decoration: underline;
  }
`;

const TourOverlay = styled(Overlay)`
  width: 360px;
  box-shadow: none;
`;

const TopRow = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: ${p => p.theme.tokens.content.muted};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const TitleRow = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  line-height: 1.4;
  white-space: wrap;
`;

const DescriptionRow = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.normal};
  line-height: 1.4;
  white-space: wrap;
  opacity: 0.9;
`;

export function TourAction(props: React.ComponentProps<typeof Button>) {
  return <Button {...props} priority="primary" size="sm" />;
}
export function TextTourAction(props: React.ComponentProps<typeof Button>) {
  return <Button {...props} priority="transparent" size="sm" borderless />;
}

const BlurWindow = styled('div')`
  content: '';
  position: absolute;
  inset: 0;
  z-index: ${p => p.theme.zIndex.tour.blur};
  user-select: none;
  backdrop-filter: blur(3px);
`;

const TourTriggerWrapper = styled('div')<{margin?: CSSProperties['margin']}>`
  &[aria-expanded='true'] {
    position: relative;
    z-index: ${p => p.theme.zIndex.tour.element};
    user-select: none;
    pointer-events: none;
    &:after {
      content: '';
      position: absolute;
      z-index: ${p => p.theme.zIndex.tour.element + 1};
      inset: 0;
      border-radius: ${p => p.theme.radius.md};
      box-shadow: inset 0 0 0 3px ${p => p.theme.tokens.border.accent};
      ${p => defined(p.margin) && `margin: ${p.margin};`}
    }
  }
`;
