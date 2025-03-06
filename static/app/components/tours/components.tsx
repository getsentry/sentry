import {Fragment, type HTMLAttributes, useContext, useEffect, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {Flex} from 'sentry/components/container/flex';
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
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
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
   * Whether the tour can be accessed by the user
   */
  isAvailable: TourState<T>['isAvailable'];
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
   * The assistant guide key of the tour. Should be declared in `src/sentry/assistant/guides.py`.
   */
  tourKey?: string;
}

export function TourContextProvider<T extends TourEnumType>({
  children,
  isAvailable,
  isCompleted,
  tourKey,
  tourContext,
  omitBlur,
  orderedStepIds,
}: TourContextProviderProps<T>) {
  const {mutate} = useMutateAssistant();
  const tourContextValue = useTourReducer<T>({
    isAvailable,
    isCompleted,
    isRegistered: false,
    orderedStepIds,
    currentStepId: null,
    tourKey,
  });
  const {dispatch, currentStepId} = tourContextValue;
  const isTourActive = currentStepId !== null;

  const tourHotkeys = useMemo(() => {
    return [
      {
        match: 'Escape',
        callback: () => {
          if (tourKey) {
            mutate({guide: tourKey, status: 'dismissed'});
          }
          dispatch({type: 'END_TOUR'});
        },
      },
      {match: ['left', 'h'], callback: () => dispatch({type: 'PREVIOUS_STEP'})},
      {match: ['right', 'l'], callback: () => dispatch({type: 'NEXT_STEP'})},
    ];
  }, [dispatch, mutate, tourKey]);

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
   */
  description: React.ReactNode;
  /**
   * The unique identifier of the tour step.
   */
  id: TourStep<T>['id'];
  /**
   * The title of the tour step.
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
  const {currentStepId, dispatch, orderedStepIds, handleStepRegistration, tourKey} =
    tourContextValue;
  const stepCount = currentStepId ? orderedStepIds.indexOf(id) + 1 : 0;
  const stepTotal = orderedStepIds.length;
  const hasPreviousStep = stepCount > 1;
  const hasNextStep = stepCount < stepTotal;
  const isOpen = currentStepId === id;
  const {mutate} = useMutateAssistant();
  useEffect(() => handleStepRegistration({id}), [id, handleStepRegistration]);

  const defaultActions = useMemo(
    () => (
      <ButtonBar gap={1}>
        {hasPreviousStep && (
          <TourAction size="xs" onClick={() => dispatch({type: 'PREVIOUS_STEP'})}>
            {t('Previous')}
          </TourAction>
        )}
        {hasNextStep ? (
          <TourAction size="xs" onClick={() => dispatch({type: 'NEXT_STEP'})}>
            {t('Next')}
          </TourAction>
        ) : (
          <TourAction size="xs" onClick={() => dispatch({type: 'END_TOUR'})}>
            {t('Finish tour')}
          </TourAction>
        )}
      </ButtonBar>
    ),
    [hasPreviousStep, hasNextStep, dispatch]
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
        }
        dispatch({type: 'END_TOUR'});
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
  }>;
}

export function TourGuide({
  children,
  title,
  description,
  actions,
  className,
  id,
  isOpen,
  position,
  handleDismiss,
  stepCount,
  wrapperComponent,
  stepTotal,
  offset,
}: TourGuideProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const isStepCountVisible = defined(stepCount) && defined(stepTotal) && stepTotal !== 1;
  const isDismissVisible = defined(handleDismiss);
  const isTopRowVisible = isStepCountVisible || isDismissVisible;
  const countText = isStepCountVisible ? `${stepCount}/${stepTotal}` : '';
  const {triggerProps, overlayProps, arrowProps} = useOverlay({
    shouldApplyMinWidth: false,
    isOpen,
    position,
    offset,
  });

  // Scroll the overlay into view when it opens
  useEffect(() => {
    if (isOpen) {
      trackAnalytics('tour-guide.open', {organization, id});
      document
        ?.getElementById(id ?? '')
        ?.scrollIntoView?.({block: 'center', behavior: 'smooth'});
    }
  }, [isOpen, id, organization]);

  const Wrapper = wrapperComponent ?? TourTriggerWrapper;

  return (
    <Fragment>
      <Wrapper
        className={className}
        ref={triggerProps.ref}
        aria-expanded={triggerProps['aria-expanded']}
      >
        {children}
      </Wrapper>
      {isOpen ? (
        <PositionWrapper zIndex={theme.zIndex.tour.overlay} {...overlayProps}>
          <TourOverlay
            animated
            arrowProps={{...arrowProps, background: 'lightModeBlack'}}
          >
            <TourBody id={id}>
              {isTopRowVisible && (
                <TopRow>
                  <div>{countText}</div>
                  {isDismissVisible && (
                    <TourCloseButton
                      onClick={e => {
                        trackAnalytics('tour-guide.close', {organization, id});
                        handleDismiss(e);
                      }}
                      icon={<IconClose style={{color: theme.inverted.textColor}} />}
                      aria-label={t('Close')}
                      borderless
                      size="sm"
                    />
                  )}
                </TopRow>
              )}
              {title && <TitleRow>{title}</TitleRow>}
              {description && <DescriptionRow>{description}</DescriptionRow>}
              {actions && <Flex justify="flex-end">{actions}</Flex>}
            </TourBody>
          </TourOverlay>
        </PositionWrapper>
      ) : null}
    </Fragment>
  );
}

/* XXX: For compatibility with Guides, we need to style 'a' tags which are often docs links */
const TourBody = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.75)};
  background: ${p => p.theme.inverted.surface400};
  padding: ${space(1.5)} ${space(2)};
  color: ${p => p.theme.inverted.textColor};
  border-radius: ${p => p.theme.borderRadius};
  width: 360px;
  a {
    color: ${p => p.theme.inverted.textColor};
    text-decoration: underline;
  }
`;

const TourCloseButton = styled(Button)`
  display: block;
  padding: 0;
  height: 14px;
  min-height: 14px;
`;

const TourOverlay = styled(Overlay)`
  width: 360px;
`;

const TopRow = styled('div')`
  display: grid;
  grid-template-columns: 1fr 15px;
  align-items: start;
  height: 18px;
  color: ${p => p.theme.inverted.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightBold};
  opacity: 0.6;
`;

const TitleRow = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  line-height: 1.4;
  white-space: wrap;
`;

const DescriptionRow = styled('div')`
  color: ${p => p.theme.inverted.textColor};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightNormal};
  line-height: 1.4;
  white-space: wrap;
  opacity: 0.9;
`;

export const TourAction = styled(Button)`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.textColor};
  background: ${p => p.theme.surface400};
  border: 0;
`;

const BlurWindow = styled('div')`
  content: '';
  position: absolute;
  inset: 0;
  z-index: ${p => p.theme.zIndex.tour.blur};
  user-select: none;
  pointer-events: none;
  backdrop-filter: blur(3px);
`;

const TourTriggerWrapper = styled('div')`
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
      border-radius: ${p => p.theme.borderRadius};
      box-shadow: inset 0 0 0 3px ${p => p.theme.subText};
    }
  }
`;
