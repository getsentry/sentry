import {createContext, useContext, useEffect, useRef} from 'react';
import {css, ThemeProvider} from '@emotion/react';
import styled from '@emotion/styled';

import exploreSpansTourSvg from 'sentry-images/spot/explore-spans-tour.svg';

import {openModal} from 'sentry/actionCreators/modal';
import {TextTourAction, TourAction} from 'sentry/components/tours/components';
import type {TourContextType} from 'sentry/components/tours/tourContext';
import {useAssistant, useMutateAssistant} from 'sentry/components/tours/useAssistant';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useInvertedTheme} from 'sentry/utils/theme/theme';
import {useIsNavTourActive} from 'sentry/views/nav/tour/tour';

export const enum ExploreSpansTour {
  // Specify keywords to narrow down search
  SEARCH_BAR = 'search-bar',
  // Specify the query to list/aggregate results
  TOOLBAR = 'toolbar',
  // View the results of the query
  RESULTS = 'results',
}

export const ORDERED_EXPLORE_SPANS_TOUR = [
  ExploreSpansTour.SEARCH_BAR,
  ExploreSpansTour.TOOLBAR,
  ExploreSpansTour.RESULTS,
];

export const EXPLORE_SPANS_TOUR_GUIDE_KEY = 'tour.explore.spans';

export const ExploreSpansTourContext =
  createContext<TourContextType<ExploreSpansTour> | null>(null);

function useExploreSpansTour(): TourContextType<ExploreSpansTour> {
  const tourContext = useContext(ExploreSpansTourContext);
  if (!tourContext) {
    throw new Error('Must be used within a TourContextProvider<ExploreSpansTour>');
  }
  return tourContext;
}

interface ExploreSpansTourModalProps {
  closeModal: () => void;
  handleDismissTour: () => void;
  handleStartTour: () => void;
}

function ExploreSpansTourModal({
  closeModal,
  handleDismissTour,
  handleStartTour,
}: ExploreSpansTourModalProps) {
  const invertedTheme = useInvertedTheme();

  return (
    <ThemeProvider theme={invertedTheme}>
      <TourContainer>
        <ModalImage src={exploreSpansTourSvg} />
        <TextContainer>
          <Title>{t('How to Query')}</Title>
          <Header>{t('Debug Like a Pro')}</Header>
          <Description>
            {t(
              'Aggregate and visualize metrics with your span data in this new query builder. You’ll be able to drill into the exact problems causing your infra bills to spike and your users to grimace.'
            )}
          </Description>
          <Footer>
            <TextTourAction
              onClick={() => {
                handleDismissTour();
                closeModal();
              }}
            >
              {t('Maybe later')}
            </TextTourAction>
            <TourAction
              onClick={() => {
                handleStartTour();
                closeModal();
              }}
              autoFocus
            >
              {t('Take a tour')}
            </TourAction>
          </Footer>
        </TextContainer>
      </TourContainer>
    </ThemeProvider>
  );
}

// Displays the introductory tour modal when a user is entering the experience for the first time.
export function useExploreSpansTourModal() {
  const hasOpenedTourModal = useRef(false);
  const {isRegistered, startTour, endTour} = useExploreSpansTour();
  const {data: assistantData} = useAssistant({
    notifyOnChangeProps: ['data'],
  });
  const {mutate: mutateAssistant} = useMutateAssistant();

  const shouldShowTourModal =
    assistantData?.find(item => item.guide === EXPLORE_SPANS_TOUR_GUIDE_KEY)?.seen ===
    false;

  const isNavTourActive = useIsNavTourActive();

  useEffect(() => {
    if (
      isRegistered &&
      shouldShowTourModal &&
      !hasOpenedTourModal.current &&
      !isNavTourActive
    ) {
      hasOpenedTourModal.current = true;
      openModal(
        props => (
          <ExploreSpansTourModal
            closeModal={props.closeModal}
            handleDismissTour={() => {
              mutateAssistant({
                guide: EXPLORE_SPANS_TOUR_GUIDE_KEY,
                status: 'dismissed',
              });
              endTour();
              props.closeModal();
            }}
            handleStartTour={startTour}
          />
        ),
        {
          modalCss: navTourModalCss,

          // If user closes modal through other means, also prevent the modal from being shown again.
          onClose: reason => {
            if (reason) {
              mutateAssistant({
                guide: EXPLORE_SPANS_TOUR_GUIDE_KEY,
                status: 'dismissed',
              });
              endTour();
            }
          },
        }
      );
    }
  }, [
    isRegistered,
    shouldShowTourModal,
    startTour,
    mutateAssistant,
    endTour,
    isNavTourActive,
  ]);
}

// XXX: The negative margin is to undo the global modal styling
const TourContainer = styled('div')`
  margin: -${space(4)} -${space(3)};
  @media (min-width: ${p => p.theme.breakpoints.md}) {
    margin: -${space(4)};
  }
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.tokens.background.primary};
  overflow: hidden;
`;

const ModalImage = styled('img')`
  width: calc(100% - ${space(1.5)} - ${space(1.5)});
  margin: ${space(1.5)} 0 0 ${space(1.5)};
  background-size: cover;
  background-position: center;
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
`;

const TextContainer = styled('div')`
  padding: ${space(1.5)} ${space(2)};
`;

const Title = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const Header = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.headerFontSize};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const Description = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.tokens.content.primary};
`;

const Footer = styled('div')`
  display: flex;
  justify-content: flex-end;
  margin-top: ${space(2)};
  gap: ${space(1)};
`;

const navTourModalCss = css`
  width: 545px;
  [role='document'] {
    box-shadow: none;
  }
`;
