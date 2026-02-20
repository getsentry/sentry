import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {
  emptyTourContext,
  ORDERED_TEST_TOUR,
  TestTour,
} from 'sentry/components/tours/testUtils';
import {useTourReducer, type TourState} from 'sentry/components/tours/tourContext';

describe('useTourReducer', () => {
  const initialState: TourState<TestTour> = {
    ...emptyTourContext,
    orderedStepIds: ORDERED_TEST_TOUR,
  };
  function registerAllSteps() {
    const {result} = renderHook(useTourReducer, {initialProps: initialState});
    const {handleStepRegistration} = result.current;
    act(() => {
      ORDERED_TEST_TOUR.forEach(stepId => handleStepRegistration({id: stepId}));
    });
    return result;
  }

  it('handles step registration correctly', () => {
    const {result} = renderHook(useTourReducer, {initialProps: initialState});
    const {handleStepRegistration} = result.current;
    let unregister = () => {};
    // Should be false before any steps are registered
    expect(result.current.isRegistered).toBe(false);
    act(() => {
      unregister = handleStepRegistration({id: TestTour.NAME});
      handleStepRegistration({id: TestTour.EMAIL});
    });
    // Should not switch until all steps have been registered
    expect(result.current.isRegistered).toBe(false);
    act(() => handleStepRegistration({id: TestTour.PASSWORD}));
    // Should switch when all steps have been registered
    expect(result.current.isRegistered).toBe(true);
    act(() => unregister());
    // Should switch back to false when all steps have been unregistered
    expect(result.current.isRegistered).toBe(false);
  });

  it('starts and ends the tour with the correctly', () => {
    const result = registerAllSteps();
    expect(result.current.currentStepId).toBeNull();
    act(() => result.current.startTour());
    expect(result.current.currentStepId).toBe(TestTour.NAME);
    act(() => result.current.startTour(TestTour.EMAIL));
    expect(result.current.currentStepId).toBe(TestTour.EMAIL);
    act(() => result.current.endTour());
    expect(result.current.currentStepId).toBeNull();
  });

  it('navigates to the next step correctly', () => {
    const result = registerAllSteps();
    expect(result.current.currentStepId).toBeNull();
    act(() => result.current.nextStep());
    expect(result.current.currentStepId).toBeNull();
    act(() => result.current.startTour());
    expect(result.current.currentStepId).toBe(TestTour.NAME);
    act(() => result.current.nextStep());
    expect(result.current.currentStepId).toBe(TestTour.EMAIL);
    act(() => result.current.nextStep());
    expect(result.current.currentStepId).toBe(TestTour.PASSWORD);
    act(() => result.current.nextStep());
    expect(result.current.currentStepId).toBeNull();
  });

  it('navigates to the previous step correctly', () => {
    const result = registerAllSteps();
    expect(result.current.currentStepId).toBeNull();
    act(() => result.current.previousStep());
    expect(result.current.currentStepId).toBeNull();
    act(() => result.current.startTour(TestTour.PASSWORD));
    expect(result.current.currentStepId).toBe(TestTour.PASSWORD);
    act(() => result.current.previousStep());
    expect(result.current.currentStepId).toBe(TestTour.EMAIL);
    act(() => result.current.previousStep());
    expect(result.current.currentStepId).toBe(TestTour.NAME);
    act(() => result.current.previousStep());
    expect(result.current.currentStepId).toBe(TestTour.NAME);
  });

  it('sets the step correctly', () => {
    const result = registerAllSteps();
    expect(result.current.currentStepId).toBeNull();
    act(() => result.current.setStep(TestTour.EMAIL));
    expect(result.current.currentStepId).toBe(TestTour.EMAIL);
    act(() => result.current.setStep(TestTour.PASSWORD));
    expect(result.current.currentStepId).toBe(TestTour.PASSWORD);
    act(() => result.current.setStep(TestTour.NAME));
    expect(result.current.currentStepId).toBe(TestTour.NAME);
  });
});
