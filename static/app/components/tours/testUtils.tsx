import {createContext} from 'react';

import type {TourContextType} from 'sentry/components/tours/tourContext';

export const enum TestTour {
  NAME = 'test-tour-name',
  EMAIL = 'test-tour-email',
  PASSWORD = 'test-tour-password',
}
export const ORDERED_TEST_TOUR = [TestTour.NAME, TestTour.EMAIL, TestTour.PASSWORD];

export const TestTourContext = createContext<TourContextType<TestTour> | null>(null);

export const emptyTourContext = {
  currentStepId: null,
  isAvailable: true,
  isCompleted: false,
  isRegistered: false,
  orderedStepIds: [],
  dispatch: jest.fn(),
  handleStepRegistration: jest.fn(),
};
