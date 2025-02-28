import {createContext, useContext} from 'react';

import {TourElement, type TourElementProps} from 'sentry/components/tours/components';
import type {TourContextType} from 'sentry/components/tours/tourContext';

export const enum TestTour {
  NAME = 'test-tour-name',
  EMAIL = 'test-tour-email',
  PASSWORD = 'test-tour-password',
}

export const ORDERED_TEST_TOUR = [TestTour.NAME, TestTour.EMAIL, TestTour.PASSWORD];
export const TestTourContext = createContext<TourContextType<TestTour>>({
  currentStepId: null,
  isAvailable: true,
  isRegistered: false,
  orderedStepIds: ORDERED_TEST_TOUR,
  dispatch: () => {},
  handleStepRegistration: () => () => {},
});

function useTestTour(): TourContextType<TestTour> {
  return useContext(TestTourContext);
}

export function TestTourElement(props: TourElementProps<TestTour>) {
  const tourContext = useTestTour();
  return <TourElement tourContext={tourContext} {...props} />;
}

export const emptyTourContext = {
  currentStepId: null,
  isAvailable: true,
  isRegistered: false,
  orderedStepIds: [],
  dispatch: jest.fn(),
  handleStepRegistration: jest.fn(),
};
