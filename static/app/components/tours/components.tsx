import {Fragment, type HTMLAttributes, useContext, useEffect, useMemo} from 'react';
import {createPortal} from 'react-dom';
import {ClassNames, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {
  type TourContextType,
  type TourEnumType,
  type TourState,
  type TourStep,
  useTourReducer,
} from 'sentry/components/tours/tourContext';
import {useMutateAssistant} from 'sentry/components/tours/useAssistant';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useEffectAfterFirstRender} from 'sentry/utils/useEffectAfterFirstRender';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import useOrganization from 'sentry/utils/useOrganization';
import useOverlay, {type UseOverlayProps} from 'sentry/utils/useOverlay';

export interface TourContextProviderProps<T extends TourEnumType> {
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
   * The React context (from React.createContext) containing the provider for the tour.
   */
  tourContext: React.Context<TourContextType<T> | null>;
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
  tourContext,
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

  const tourHotkeys = useMemo(() => {
    if (!isTourActive) {
      return [];
    }

    return [
      {
        match: 'Escape',
        callback: () => {
          if (tourKey) {
            mutate({guide: tourKey, status: 'dismissed'});
          }
          trackAnalytics('tour-guide.dismiss', {organization, id: `${currentStepId}`});
          endTour();
        },
      },
      {match: ['left', 'h'], callback: () => previousStep()},
      {match: ['right', 'l'], callback: () => nextStep()},
    ];
  }, [
    isTourActive,
    tourKey,
    organization,
    currentStepId,
    endTour,
    mutate,
    previousStep,
    nextStep,
  ]);

  useHotkeys(tourHotkeys);

  useEffect(() => {
    if (isTourActive && tourKey) {
      mutate({guide: tourKey, status: 'viewed'});
    }
  }, [isTourActive, mutate, tourKey]);

  return (
    <tourContext.Provider value={tourContextValue}>
      {isTourActive && !omitBlur && <BlurWindow data-test-id="tour-blur-window" />}
      {children}
    </tourContext.Provider>
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

function TourElementContent<T extends TourEnumType>({
  children,
  id,
  title,
  description,
  tourContextValue,
  position,
  className,
  actions,
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
      <ButtonBar gap={1}>
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
  offset?: UseOverlayProps['offset'];
  position?: UseOverlayProps['position'];
  stepCount?: number;
  stepTotal?: number;
  title?: React.ReactNode;
  wrapperComponent?: React.ComponentType<{
    'aria-expanded': React.AriaAttributes['aria-expanded'];
    children: React.ReactNode;
    ref: React.RefAttributes<HTMLElement>['ref'];
    prefersDarkMode?: boolean;
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
}: TourGuideProps) {
  const config = useLegacyStore(ConfigStore);
  const prefersDarkMode = config.theme === 'dark';
  const theme = useTheme();

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
        prefersDarkMode={prefersDarkMode}
      >
        {children}
      </Wrapper>
      {isOpen && defined(title) && defined(description)
        ? createPortal(
            <PositionWrapper zIndex={theme.zIndex.tour.overlay} {...overlayProps}>
              <ClassNames>
                {({css}) => (
                  <TourOverlay
                    animated
                    arrowProps={{
                      ...arrowProps,
                      strokeWidth: 0,
                      className: css`
                        path.fill {
                          fill: ${theme.tour.background};
                        }
                        path.stroke {
                          stroke: transparent;
                        }
                      `,
                    }}
                  >
                    <TourBody ref={scrollToElement} prefersDarkMode={prefersDarkMode}>
                      {isTopRowVisible && (
                        <TopRow>
                          <div>{countText}</div>
                          {isDismissVisible && (
                            <TourCloseButton
                              onClick={handleDismiss}
                              icon={<IconClose />}
                              aria-label={t('Close')}
                              borderless
                              size="sm"
                            />
                          )}
                        </TopRow>
                      )}
                      {title && <TitleRow>{title}</TitleRow>}
                      {description && <DescriptionRow>{description}</DescriptionRow>}
                      {actions && <ActionRow>{actions}</ActionRow>}
                    </TourBody>
                  </TourOverlay>
                )}
              </ClassNames>
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
const TourBody = styled('div')<{prefersDarkMode: boolean}>`
  display: flex;
  flex-direction: column;
  background: ${p => p.theme.tour.background};
  padding: ${space(1.5)} ${space(2)};
  color: ${p => p.theme.tour.text};
  border-radius: ${p => p.theme.borderRadius};
  width: 360px;
  a {
    color: ${p => p.theme.tour.text};
    text-decoration: underline;
  }
`;

const TourCloseButton = styled(Button)`
  display: block;
  padding: 0;
  height: 14px;
  min-height: 14px;
  color: ${p => p.theme.tour.close};
  &:hover {
    color: ${p => p.theme.tour.close};
  }
`;

const TourOverlay = styled(Overlay)`
  width: 360px;
  box-shadow: none;
`;

const TopRow = styled('div')`
  display: grid;
  grid-template-columns: 1fr 15px;
  align-items: start;
  height: 18px;
  color: ${p => p.theme.tour.close};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightBold};
  opacity: 0.6;
`;

const TitleRow = styled('div')`
  color: ${p => p.theme.tour.header};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  line-height: 1.4;
  white-space: wrap;
`;

const DescriptionRow = styled('div')`
  color: ${p => p.theme.tour.text};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightNormal};
  line-height: 1.4;
  white-space: wrap;
  opacity: 0.9;
`;

const ActionRow = styled('div')`
  display: flex;
  justify-content: flex-end;
  margin-top: ${space(1)};
`;

export const TourAction = styled(Button)`
  border: 0;
  background: ${p => p.theme.white};
  color: ${p => p.theme.tour.next};

  &:hover,
  &:active,
  &:focus {
    color: ${p => p.theme.tour.next};
  }
`;

export const TextTourAction = styled(Button)`
  border: 0;
  box-shadow: none;
  background: transparent;
  color: ${p => p.theme.tour.previous};
  &:hover,
  &:active,
  &:focus {
    color: ${p => p.theme.tour.previous};
  }
`;

const BlurWindow = styled('div')`
  content: '';
  position: absolute;
  inset: 0;
  z-index: ${p => p.theme.zIndex.tour.blur};
  user-select: none;
  backdrop-filter: blur(3px);
`;

const TourTriggerWrapper = styled('div')<{prefersDarkMode: boolean}>`
  &[aria-expanded='true'] {
    position: relative;
    z-index: ${p => p.theme.zIndex.tour.element};
    user-select: none;
    pointer-events: none;
    &:after {
      content: '';
      opacity: 0.5;
      position: absolute;
      z-index: ${p => p.theme.zIndex.tour.element + 1};
      inset: 0;
      border-radius: ${p => p.theme.borderRadius};
      box-shadow: inset 0 0 0 3px ${p => p.theme.tour.background};
    }
  }
`;
