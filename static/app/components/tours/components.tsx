import {Fragment, useEffect, useMemo} from 'react';
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
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import useOverlay, {type UseOverlayProps} from 'sentry/utils/useOverlay';

interface TourContextProviderProps<T extends TourEnumType> {
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
   * The React context (from createContext) containing the provider for the tour.
   * The value for this prop comes from useTourReducer, to avoid extra steps.
   */
  tourContext: React.Context<TourContextType<T>>;
}

export function TourContextProvider<T extends TourEnumType>({
  children,
  isAvailable,
  tourContext,
  orderedStepIds,
}: TourContextProviderProps<T>) {
  const tourContextValue = useTourReducer<T>({
    isAvailable,
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
      {isTourActive && <BlurWindow />}
      {children}
    </tourContext.Provider>
  );
}

interface BaseTourElementProps<T extends TourEnumType> extends Partial<UseOverlayProps> {
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
   * The relevant tour context
   */
  tourContext: TourContextType<T>;
  /**
   * The className of the wrapper element.
   */
  className?: string;
}

/**
 * Most implementations of TourElementProps will hook in their own context.
 */
export type TourElementProps<T extends TourEnumType> = Omit<
  BaseTourElementProps<T>,
  'tourContext'
>;

export function TourElement<T extends TourEnumType>({
  children,
  id,
  title,
  description,
  tourContext,
  position,
  className,
}: BaseTourElementProps<T>) {
  const theme = useTheme();
  const {currentStepId, dispatch, orderedStepIds, registerStep} = tourContext;
  const stepCount = currentStepId ? orderedStepIds.indexOf(id) + 1 : 0;
  const stepTotal = orderedStepIds.length;
  const hasPreviousStep = stepCount > 1;
  const hasNextStep = stepCount < stepTotal;
  const isOpen = currentStepId === id;

  const {triggerProps, triggerRef, overlayProps} = useOverlay({
    isOpen,
    position,
    disableTrigger: true,
  });
  const element = triggerRef.current;

  useEffect(() => registerStep({id, element}), [id, element, registerStep]);

  return (
    <Fragment>
      <ElementWrapper
        className={className}
        ref={triggerProps.ref}
        aria-expanded={triggerProps['aria-expanded']}
      >
        {children}
      </ElementWrapper>
      {isOpen ? (
        <PositionWrapper zIndex={theme.zIndex.tour.overlay} {...overlayProps}>
          <TourOverlay animated>
            <TopRow>
              <div>
                {stepCount}/{stepTotal}
              </div>
              <TourCloseButton
                onClick={() => dispatch({type: 'END_TOUR'})}
                icon={<IconClose style={{color: theme.inverted.textColor}} />}
                aria-label={t('Close')}
                borderless
                size="sm"
              />
            </TopRow>
            <TitleRow>{title}</TitleRow>
            <div>{description}</div>
            <ActionBar gap={1}>
              {hasPreviousStep && (
                <ActionButton size="xs" onClick={() => dispatch({type: 'PREVIOUS_STEP'})}>
                  {t('Previous')}
                </ActionButton>
              )}
              {hasNextStep ? (
                <ActionButton size="xs" onClick={() => dispatch({type: 'NEXT_STEP'})}>
                  {t('Next')}
                </ActionButton>
              ) : (
                <ActionButton size="xs" onClick={() => dispatch({type: 'END_TOUR'})}>
                  {t('Finish tour')}
                </ActionButton>
              )}
            </ActionBar>
          </TourOverlay>
        </PositionWrapper>
      ) : null}
    </Fragment>
  );
}

const BlurWindow = styled('div')`
  content: '';
  position: absolute;
  inset: 0;
  z-index: ${p => p.theme.zIndex.tour.blur};
  user-select: none;
  pointer-events: none;
  backdrop-filter: blur(3px);
`;

const ElementWrapper = styled('div')`
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

const TourOverlay = styled(Overlay)`
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

const ActionBar = styled(ButtonBar)`
  justify-content: flex-end;
`;

const ActionButton = styled(Button)`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.textColor};
  background: ${p => p.theme.surface400};
  border: 0;
`;
