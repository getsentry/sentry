import {Fragment, type HTMLAttributes, useContext, useEffect, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {
  type TourContextType,
  type TourEnumType,
  type TourState,
  type TourStep,
  useTourReducer,
} from 'sentry/components/tours/tourContext';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useHotkeys} from 'sentry/utils/useHotkeys';
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
}

export function TourContextProvider<T extends TourEnumType>({
  children,
  isAvailable,
  tourContext,
  omitBlur,
  orderedStepIds,
}: TourContextProviderProps<T>) {
  const tourContextValue = useTourReducer<T>({
    isAvailable,
    isRegistered: false,
    orderedStepIds,
    currentStepId: null,
  });
  const {dispatch, currentStepId} = tourContextValue;
  const isTourActive = currentStepId !== null;

  const tourHotkeys = useMemo(() => {
    return [
      {match: 'Escape', callback: () => dispatch({type: 'END_TOUR'})},
      {match: ['left', 'h'], callback: () => dispatch({type: 'PREVIOUS_STEP'})},
      {match: ['right', 'l'], callback: () => dispatch({type: 'NEXT_STEP'})},
    ];
  }, [dispatch]);

  useHotkeys(tourHotkeys);

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
   * The position of the tour element.
   */
  position?: UseOverlayProps['position'];
}

export function TourElement<T extends TourEnumType>({
  tourContext,
  ...props
}: TourElementProps<T>) {
  const tourContextValue = useContext(tourContext);
  if (!tourContextValue) {
    throw new Error('Must be used within a TourContextProvider');
  }
  return <TourElementContent {...props} tourContextValue={tourContextValue} />;
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
}: TourElementContentProps<T>) {
  const theme = useTheme();
  const {currentStepId, dispatch, orderedStepIds, handleStepRegistration} =
    tourContextValue;
  const stepCount = currentStepId ? orderedStepIds.indexOf(id) + 1 : 0;
  const stepTotal = orderedStepIds.length;
  const hasPreviousStep = stepCount > 1;
  const hasNextStep = stepCount < stepTotal;
  const isOpen = currentStepId === id;

  const {triggerProps, triggerRef, overlayProps, arrowProps} = useOverlay({
    isOpen,
    position,
    disableTrigger: true,
  });
  const element = triggerRef.current;

  useEffect(
    () => handleStepRegistration({id, element}),
    [id, element, handleStepRegistration]
  );

  return (
    <Fragment>
      <TourTriggerWrapper
        className={className}
        ref={triggerProps.ref}
        aria-expanded={triggerProps['aria-expanded']}
      >
        {children}
      </TourTriggerWrapper>
      {isOpen ? (
        <PositionWrapper zIndex={theme.zIndex.tour.overlay} {...overlayProps}>
          <Overlay animated arrowProps={{...arrowProps, background: 'lightModeBlack'}}>
            <TourOverlayBody
              handleDismiss={() => dispatch({type: 'END_TOUR'})}
              stepCount={stepCount}
              stepTotal={stepTotal}
              title={title}
              description={description}
              actions={
                <ActionBar gap={1}>
                  {hasPreviousStep && (
                    <TourAction
                      size="xs"
                      onClick={() => dispatch({type: 'PREVIOUS_STEP'})}
                    >
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
                </ActionBar>
              }
            />
          </Overlay>
        </PositionWrapper>
      ) : null}
    </Fragment>
  );
}

interface TourOverlayBodyProps {
  description: React.ReactNode;
  handleDismiss: (e: React.MouseEvent) => void;
  stepCount: number;
  stepTotal: number;
  actions?: React.ReactNode;
  title?: React.ReactNode;
}

export function TourOverlayBody({
  stepCount,
  stepTotal,
  title,
  description,
  actions,
  handleDismiss,
}: TourOverlayBodyProps) {
  const theme = useTheme();
  return (
    <TourBody>
      <TopRow>
        <div>
          {stepCount}/{stepTotal}
        </div>
        <TourCloseButton
          onClick={handleDismiss}
          icon={<IconClose style={{color: theme.inverted.textColor}} />}
          aria-label={t('Close')}
          borderless
          size="sm"
        />
      </TopRow>
      {title && <TitleRow>{title}</TitleRow>}
      {description && <div>{description}</div>}
      {actions}
    </TourBody>
  );
}

const TourBody = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.75)};
  background: ${p => p.theme.inverted.surface400};
  padding: ${space(1.5)} ${space(2)};
  color: ${p => p.theme.inverted.textColor};
  border-radius: ${p => p.theme.borderRadius};
  max-width: 360px;
`;

const TourCloseButton = styled(Button)`
  display: block;
  padding: 0;
  height: 14px;
`;

const TopRow = styled('div')`
  display: flex;
  height: 18px;
  justify-content: space-between;
  align-items: center;
  color: ${p => p.theme.inverted.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightBold};
  opacity: 0.6;
`;

const TitleRow = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: ${p => p.theme.fontWeightBold};
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
      inset: 0;
      border-radius: ${p => p.theme.borderRadius};
      box-shadow: inset 0 0 0 3px ${p => p.theme.subText};
    }
  }
`;

const ActionBar = styled(ButtonBar)`
  justify-content: flex-end;
`;
