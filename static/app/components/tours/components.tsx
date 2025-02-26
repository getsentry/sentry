import {Fragment, useEffect} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';

import {Button} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
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
import useOverlay, {type UseOverlayProps} from 'sentry/utils/useOverlay';

export function TourContextProvider<T extends TourEnumType>({
  children,
  initialState,
  orderedStepIds,
  tourContext: TourContext,
}: {
  children: React.ReactNode;
  initialState: Partial<TourState<T>>;
  orderedStepIds: T[];
  tourContext: React.Context<TourContextType<T>>;
}) {
  const tourContext = useTourReducer<T>({initialState, orderedStepIds});
  const isTourActive = tourContext.currentStep !== null;
  return (
    <TourContext.Provider value={tourContext}>
      <BlurContainer>
        {children}
        {isTourActive && <BlurWindow />}
      </BlurContainer>
    </TourContext.Provider>
  );
}

export interface TourElementProps<T extends TourEnumType>
  extends Partial<UseOverlayProps> {
  /**
   * The content being focused during the tour.
   */
  children: React.ReactNode;
  /**
   * The description of the tour step.
   */
  description: string;
  id: TourStep<T>['id'];
  /**
   * The title of the tour step.
   */
  title: string;
  /**
   * The tour context.
   */
  tourContext: TourContextType<T>;
}

export function TourElement<T extends TourEnumType>({
  children,
  id,
  title,
  description,
  tourContext,
  position,
}: TourElementProps<T>) {
  const theme = useTheme();

  const {dispatch, currentStep, orderedStepIds} = tourContext;
  const stepCount = currentStep ? orderedStepIds.indexOf(id) + 1 : 0;
  const stepTotal = orderedStepIds.length;
  const hasPreviousStep = stepCount > 1;
  const hasNextStep = stepCount < stepTotal;
  const isOpen = currentStep?.id === id;

  const {triggerProps, triggerRef, overlayProps} = useOverlay({isOpen, position});
  const {current: element} = triggerRef;

  useEffect(() => {
    dispatch({
      type: 'REGISTER_STEP',
      step: {id, element},
    });
  }, [id, element, dispatch]);

  const focusStyles = css`
    position: relative;
    z-index: ${theme.zIndex.toast};
    &:after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: ${theme.borderRadius};
      box-shadow: inset 0 0 0 3px ${theme.subText};
    }
  `;

  return (
    <Fragment>
      <div css={isOpen ? focusStyles : undefined} {...triggerProps}>
        {children}
      </div>
      {isOpen ? (
        <FocusScope autoFocus restoreFocus>
          <PositionWrapper zIndex={theme.zIndex.tooltip} {...overlayProps}>
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
              <Flex justify="flex-end" gap={1}>
                {hasPreviousStep && (
                  <ActionButton
                    size="xs"
                    onClick={() => dispatch({type: 'PREVIOUS_STEP'})}
                  >
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
              </Flex>
            </TourOverlay>
          </PositionWrapper>
        </FocusScope>
      ) : null}
    </Fragment>
  );
}

const BlurContainer = styled('div')`
  position: relative;
`;

const BlurWindow = styled('div')`
  position: absolute;
  inset: 0;
  content: '';
  z-index: ${p => p.theme.zIndex.modal};
  user-select: none;
  backdrop-filter: blur(3px);
  overscroll-behavior: none;
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

const ActionButton = styled(Button)`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.textColor};
  background: ${p => p.theme.surface400};
  border: 0;
`;
