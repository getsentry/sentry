import type {HTMLAttributes} from 'react';
import {Fragment, useContext, useEffect, useMemo, useRef} from 'react';
import {createPortal} from 'react-dom';
import {ClassNames, ThemeProvider, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {mergeProps} from '@react-aria/utils';
import {IconClose} from '@sentry/icons/close';

import {Button} from '@sentry/scraps/button';
import {useHotkeys} from '@sentry/scraps/hotkey';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Overlay, PositionWrapper} from '@sentry/scraps/overlay';
import {Text} from '@sentry/scraps/text';
import {useInvertedTheme} from '@sentry/scraps/theme';
import {useOverlay, type UseOverlayProps} from '@sentry/scraps/useOverlay';

import {
  useTourReducer,
  type TourContextType,
  type TourEnumType,
  type TourState,
  type TourStep,
  type TourVariant,
} from 'sentry/components/tours/tourContext';
import {useMutateAssistant} from 'sentry/components/tours/useAssistant';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';

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
   * Whether the tour can be shown. A disabled tour is hidden from its elements
   * without ending: it does not blur the page, mark the guide as viewed, or
   * handle hotkeys, and resumes at the same step once enabled again.
   * @default true
   */
  enabled?: boolean;
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
  /**
   * How the tour presents itself. Use `subtle` for pages users already know.
   * @default 'spotlight'
   */
  variant?: TourVariant;
}

export function TourContextProvider<T extends TourEnumType>({
  children,
  isCompleted,
  tourKey,
  TourContext,
  orderedStepIds,
  enabled = true,
  variant = 'spotlight',
  onEndTour,
  onStartTour,
  onStepChange,
  requireAllStepsRegistered,
}: TourContextProviderProps<T>) {
  const organization = useOrganization({allowNull: true});
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
  const isTourActive = currentStepId !== null && enabled;
  const visibleTourContextValue = useMemo(
    () => ({
      ...tourContextValue,
      currentStepId: enabled ? currentStepId : null,
      variant,
    }),
    [enabled, tourContextValue, currentStepId, variant]
  );

  // Subtle tours leave the page usable, so their guides handle these keys only
  // while focused instead.
  useHotkeys(
    isTourActive && variant === 'spotlight'
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
                step_count: orderedStepIds.indexOf(currentStepId) + 1,
                tour_key: tourKey,
              });
              endTour();
            },
          },
          {match: ['left', 'h'], callback: () => previousStep()},
          {match: ['right', 'l'], callback: () => nextStep()},
        ]
      : []
  );

  // Spotlight tours count as seen once shown. Subtle tours only count once the
  // user finishes or dismisses them, so one left mid-way shows up again.
  useEffect(() => {
    if (isTourActive && tourKey && variant === 'spotlight') {
      mutate({guide: tourKey, status: 'viewed'});
    }
  }, [isTourActive, mutate, tourKey, variant]);

  return (
    <TourContext value={visibleTourContextValue}>
      {isTourActive && variant === 'spotlight' && (
        <BlurWindow data-test-id="tour-blur-window" />
      )}
      {children}
    </TourContext>
  );
}

interface TourRenderProps {
  /**
   * Ref to attach to the element for positioning.
   * Uses `any` to allow flexibility in spreading onto different element types.
   */
  ref: React.Ref<any>;
  /**
   * ARIA attribute indicating if the tour is active
   */
  'aria-expanded'?: boolean | undefined;
  /**
   * CSS class for tour highlight styling
   */
  className?: string;
}

export interface TourElementProps<T extends TourEnumType> extends Omit<
  HTMLAttributes<HTMLElement>,
  'id' | 'children' | 'title'
> {
  /**
   * Render function that receives tour props to apply to the element.
   * This allows the tour to work with any element without wrapping it in a div.
   *
   * Example:
   * ```tsx
   * <TourElement id="step1" title="Title" description="Description">
   *   {(props) => <button {...props}>Click me</button>}
   * </TourElement>
   * ```
   */
  children: (props: TourRenderProps) => React.ReactNode;
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
    // Tour is not active, render children with no-op props
    return children({
      'aria-expanded': false,
      ref: () => {},
    });
  }

  return (
    <TourElementContent {...props} tourContextValue={tourContextValue}>
      {children}
    </TourElementContent>
  );
}

interface TourElementContentProps<T extends TourEnumType> extends Omit<
  TourElementProps<T>,
  'tourContext'
> {
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
  const organization = useOrganization({allowNull: true});
  const {
    currentStepId,
    orderedStepIds,
    handleStepRegistration,
    tourKey,
    previousStep,
    nextStep,
    endTour,
    variant,
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
      <Grid flow="column" align="center" gap="md">
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
              if (tourKey && variant === 'subtle') {
                mutate({guide: tourKey, status: 'viewed'});
              }
              endTour();
              trackAnalytics('tour-guide.finish', {
                organization,
                id: id.toString(),
                step_count: stepCount,
                tour_key: tourKey,
              });
            }}
          >
            {t('Done')}
          </TourAction>
        )}
      </Grid>
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
      variant,
      mutate,
    ]
  );

  const dismiss = () => {
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
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      dismiss();
    } else if (event.key === 'ArrowLeft' && hasPreviousStep) {
      previousStep();
    } else if (event.key === 'ArrowRight' && hasNextStep) {
      nextStep();
    }
  };

  return (
    <TourGuide
      title={title}
      description={description}
      actions={defined(actions) ? actions : defaultActions}
      className={className}
      isOpen={isOpen}
      position={position}
      handleDismiss={dismiss}
      onKeyDown={variant === 'subtle' ? handleKeyDown : undefined}
      stepCount={stepCount}
      stepTotal={stepTotal}
      id={`${id}`}
      margin={margin}
    >
      {children}
    </TourGuide>
  );
}

interface TourGuideProps extends Omit<
  HTMLAttributes<HTMLElement>,
  'title' | 'id' | 'children'
> {
  /**
   * Render function that receives tour props to apply to the element.
   */
  children: (props: TourRenderProps) => React.ReactNode;
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
  margin?: number;
  offset?: UseOverlayProps['offset'];
  /**
   * Handles keys pressed while the guide has focus. The guide can then be
   * focused, and keeps focus when the tour moves to another step.
   */
  onKeyDown?: (event: React.KeyboardEvent) => void;
  position?: UseOverlayProps['position'];
  stepCount?: number;
  stepTotal?: number;
  title?: React.ReactNode;
}

const zIndex = {
  blur: 10100,
  element: 10101,
  overlay: 10102,
};

/**
 * Keep the guide inside the viewport even when that means overlapping its
 * highlighted element, such as one that is taller than the viewport.
 */
const keepGuideInViewport = {crossAxis: true, tether: false};

/**
 * Whether focus is inside a guide, and whether a guide that had focus just
 * closed. A step change closes one guide and opens the next in the same commit,
 * so the next guide can take focus over. The handoff expires right after that
 * commit, so a guide that opens later never steals focus.
 */
let guideHasFocus = false;
let isHandingOffGuideFocus = false;

function releaseGuideFocus() {
  if (!guideHasFocus) {
    return;
  }
  guideHasFocus = false;
  isHandingOffGuideFocus = true;
  queueMicrotask(() => {
    isHandingOffGuideFocus = false;
  });
}

function takeGuideFocus() {
  const shouldTakeFocus = isHandingOffGuideFocus;
  isHandingOffGuideFocus = false;
  return shouldTakeFocus;
}

function handleGuideFocus() {
  guideHasFocus = true;
}

function handleGuideBlur(event: React.FocusEvent<HTMLElement>) {
  // A guide removed by a step change can still blur. Its focus is handed off.
  if (
    event.currentTarget.isConnected &&
    !event.currentTarget.contains(event.relatedTarget)
  ) {
    guideHasFocus = false;
  }
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
  stepTotal,
  offset,
  margin,
  onKeyDown,
}: TourGuideProps) {
  const theme = useTheme();
  const invertedTheme = useInvertedTheme();

  const isStepCountVisible = defined(stepCount) && defined(stepTotal) && stepTotal !== 1;
  const isDismissVisible = defined(handleDismiss);
  const isTopRowVisible = isStepCountVisible || isDismissVisible;
  const countText = isStepCountVisible ? `${stepCount}/${stepTotal}` : '';
  const {triggerProps, triggerRef, overlayProps, overlayRef, arrowProps} = useOverlay({
    shouldApplyMinWidth: false,
    isOpen,
    position,
    offset,
    strategy: 'fixed',
    preventOverflowOptions: keepGuideInViewport,
  });

  // Scroll the highlighted element rather than the guide. The element may live in
  // a nested scroll container (e.g. the issue details sidebar, which stacks below
  // the content at narrow widths); the guide is portaled to the body and can't
  // scroll that container.
  useEffect(() => {
    if (isOpen) {
      triggerRef.current?.scrollIntoView?.({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [isOpen, triggerRef]);

  // When the tour moves to another step while a guide has focus, focus the next
  // guide so the user can keep navigating with the keyboard.
  const isFocusable = defined(onKeyDown);
  const shouldTakeFocusRef = useRef(false);
  useEffect(() => {
    if (!isOpen || !isFocusable) {
      shouldTakeFocusRef.current = false;
      return;
    }
    if (takeGuideFocus()) {
      shouldTakeFocusRef.current = true;
    }
    // The guide's element can attach after it opens; this runs again then.
    if (shouldTakeFocusRef.current && overlayRef.current) {
      shouldTakeFocusRef.current = false;
      overlayRef.current.focus();
    }
    return releaseGuideFocus;
  }, [isOpen, isFocusable, overlayRef]);
  const focusProps: HTMLAttributes<HTMLElement> = isFocusable
    ? {tabIndex: -1, onKeyDown, onFocus: handleGuideFocus, onBlur: handleGuideBlur}
    : {};

  return (
    <Fragment>
      <ClassNames>
        {({css, cx}) => {
          const tourStyles = getTourElementStyles(theme, !!isOpen, margin);
          const tourClassName = tourStyles ? css(tourStyles) : undefined;

          return children({
            'aria-expanded': Boolean(triggerProps['aria-expanded']),
            ref: triggerProps.ref,
            className: cx(className, tourClassName),
          });
        }}
      </ClassNames>
      {isOpen && defined(title) && defined(description)
        ? createPortal(
            <PositionWrapper
              zIndex={zIndex.overlay}
              {...mergeProps(overlayProps, focusProps)}
            >
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
                      <Stack
                        background="primary"
                        radius="md"
                        width="395px"
                        maxWidth={TOUR_GUIDE_MAX_WIDTH}
                        padding="lg xl xl"
                        gap="md"
                      >
                        {isTopRowVisible && (
                          <Flex
                            justify="between"
                            align="center"
                            minHeight={theme.form.sm.height}
                          >
                            <Text size="sm" variant="muted" bold>
                              {countText}
                            </Text>
                            {isDismissVisible && (
                              <Button
                                variant="transparent"
                                onClick={handleDismiss}
                                icon={<IconClose />}
                                aria-label={t('Close')}
                                size="xs"
                              />
                            )}
                          </Flex>
                        )}
                        {title && (
                          <Text as="div" size="xl" bold density="comfortable">
                            {title}
                          </Text>
                        )}
                        {description && (
                          <Text as="div" size="md" density="comfortable">
                            {description}
                          </Text>
                        )}
                        {actions && (
                          <Flex justify="end" paddingTop="xs">
                            {actions}
                          </Flex>
                        )}
                      </Stack>
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

// useOverlay keeps 16px between the guide and each edge of the viewport.
const TOUR_GUIDE_MAX_WIDTH = 'calc(100vw - 32px)';

// Replaces the Overlay's own shadow, which no layout primitive can override.
const TourOverlay = styled(Overlay)`
  box-shadow: ${p => p.theme.shadow.high};
`;

export function TourAction(props: React.ComponentProps<typeof Button>) {
  return <Button {...props} variant="primary" size="sm" />;
}
export function TextTourAction(props: React.ComponentProps<typeof Button>) {
  return <Button {...props} variant="transparent" size="sm" />;
}

const BlurWindow = styled('div')`
  content: '';
  position: absolute;
  inset: 0;
  z-index: ${zIndex.blur};
  user-select: none;
  backdrop-filter: blur(3px);
`;

/**
 * Generates CSS class for tour element highlighting.
 * This is applied via the render prop pattern to avoid wrapping elements in divs.
 */
function getTourElementStyles(
  theme: ReturnType<typeof useTheme>,
  isOpen: boolean,
  margin?: number
) {
  if (!isOpen) {
    return;
  }

  return `
    position: relative;
    z-index: ${zIndex.element};
    user-select: none;
    pointer-events: none;

    &:after {
      content: '';
      position: absolute;
      z-index: ${zIndex.element + 1};
      inset: 0;
      border-radius: ${theme.radius.md};
      box-shadow: inset 0 0 0 3px ${theme.tokens.border.accent.vibrant};
      ${defined(margin) ? `margin: ${margin}px;` : ''}
    }
  `;
}
