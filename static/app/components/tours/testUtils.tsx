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
  isCompleted: false,
  isRegistered: false,
  orderedStepIds: [],
  handleStepRegistration: jest.fn(),
  startTour: jest.fn(),
  endTour: jest.fn(),
  nextStep: jest.fn(),
  previousStep: jest.fn(),
  setStep: jest.fn(),
};

export const mockTour = () => emptyTourContext;
