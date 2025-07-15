import {createContext, Fragment, useContext, useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import exploreSpansTourSvg from 'sentry-images/spot/explore-spans-tour.svg';

import {openModal} from 'sentry/actionCreators/modal';
import {StartTourModal, startTourModalCss} from 'sentry/components/tours/startTour';
import type {TourContextType} from 'sentry/components/tours/tourContext';
import {useAssistant, useMutateAssistant} from 'sentry/components/tours/useAssistant';
import {t} from 'sentry/locale';
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
          <StartTourModal
            header={
              <Fragment>
                <Title>How to Query</Title>
                {t('Debug Like a Pro')}
              </Fragment>
            }
            description={t(
              'Aggregate and visualize metrics with your span data in this new query builder. You’ll be able to drill into the exact problems causing your infra bills to spike and your users to grimace.'
            )}
            imgSrc={exploreSpansTourSvg}
            closeModal={props.closeModal}
            onDismissTour={() => {
              mutateAssistant({
                guide: EXPLORE_SPANS_TOUR_GUIDE_KEY,
                status: 'dismissed',
              });
              endTour();
              props.closeModal();
            }}
            onStartTour={startTour}
          />
        ),
        {
          modalCss: startTourModalCss,

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

const Title = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
`;
