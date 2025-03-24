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
import {darkTheme, lightTheme} from 'sentry/utils/theme';
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
  const organization = useOrganization();
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
          dispatch({type: 'END_TOUR'});
        },
      },
      {match: ['left', 'h'], callback: () => dispatch({type: 'PREVIOUS_STEP'})},
      {match: ['right', 'l'], callback: () => dispatch({type: 'NEXT_STEP'})},
    ];
  }, [dispatch, mutate, tourKey, isTourActive, organization, currentStepId]);

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
          <TextTourAction size="xs" onClick={() => dispatch({type: 'PREVIOUS_STEP'})}>
            {t('Previous')}
          </TextTourAction>
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
  id,
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

  useEffect(() => {
    if (isOpen) {
      trackAnalytics('tour-guide.open', {organization, id});
    }
  }, [isOpen, id, organization]);

  const Wrapper = wrapperComponent ?? TourTriggerWrapper;

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
      {isOpen
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
                          fill: ${prefersDarkMode
                            ? darkTheme.purple300
                            : darkTheme.surface400};
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
                              onClick={e => {
                                trackAnalytics('tour-guide.dismiss', {organization, id});
                                handleDismiss(e);
                              }}
                              icon={<IconClose style={{color: darkTheme.textColor}} />}
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
  background: ${p => (p.prefersDarkMode ? darkTheme.purple300 : darkTheme.surface400)};
  padding: ${space(1.5)} ${space(2)};
  color: ${darkTheme.textColor};
  border-radius: ${p => p.theme.borderRadius};
  width: 360px;
  a {
    color: ${darkTheme.textColor};
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
  box-shadow: none;
`;

const TopRow = styled('div')`
  display: grid;
  grid-template-columns: 1fr 15px;
  align-items: start;
  height: 18px;
  color: ${lightTheme.white};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightBold};
  opacity: 0.6;
`;

const TitleRow = styled('div')`
  color: ${darkTheme.headingColor};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  line-height: 1.4;
  white-space: wrap;
`;

const DescriptionRow = styled('div')`
  color: ${darkTheme.textColor};
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
  background: ${lightTheme.white};
  color: ${lightTheme.headingColor};
  &:hover,
  &:active,
  &:focus {
    color: ${lightTheme.headingColor};
  }
`;

export const TextTourAction = styled(Button)`
  border: 0;
  box-shadow: none;
  background: transparent;
  color: ${lightTheme.white};
  &:hover,
  &:active,
  &:focus {
    color: ${lightTheme.white};
  }
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
      box-shadow: inset 0 0 0 3px
        ${p => (p.prefersDarkMode ? darkTheme.purple300 : darkTheme.surface400)};
    }
  }
`;
