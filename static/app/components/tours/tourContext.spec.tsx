import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {
  emptyTourContext,
  ORDERED_TEST_TOUR,
  TestTour,
} from 'sentry/components/tours/testUtils';
import {type TourState, useTourReducer} from 'sentry/components/tours/tourContext';

describe('useTourReducer', () => {
  const mockElement = document.createElement('div');
  const initialState: TourState<TestTour> = {
    ...emptyTourContext,
    orderedStepIds: ORDERED_TEST_TOUR,
  };
  function registerAllSteps() {
    const {result} = renderHook(() => useTourReducer<TestTour>(initialState));
    const {handleStepRegistration} = result.current;
    act(() => {
      ORDERED_TEST_TOUR.forEach(stepId =>
        handleStepRegistration({id: stepId, element: mockElement})
      );
    });
    return result;
  }

  it('handles step registration correctly', () => {
    const {result} = renderHook(() => useTourReducer<TestTour>(initialState));
    const {handleStepRegistration} = result.current;
    let unregister = () => {};
    // Should be false before any steps are registered
    expect(result.current.isRegistered).toBe(false);
    act(() => {
      unregister = handleStepRegistration({id: TestTour.NAME, element: mockElement});
      handleStepRegistration({id: TestTour.EMAIL, element: mockElement});
    });
    // Should not switch until all steps have been registered
    expect(result.current.isRegistered).toBe(false);
    act(() => handleStepRegistration({id: TestTour.PASSWORD, element: mockElement}));
    // Should switch when all steps have been registered
    expect(result.current.isRegistered).toBe(true);
    act(() => unregister());
    // Should switch back to false when all steps have been unregistered
    expect(result.current.isRegistered).toBe(false);
  });

  it('starts and ends the tour with the correctly', () => {
    const result = registerAllSteps();
    expect(result.current.currentStepId).toBeNull();
    act(() => result.current.dispatch({type: 'START_TOUR'}));
    expect(result.current.currentStepId).toBe(TestTour.NAME);
    act(() => result.current.dispatch({type: 'START_TOUR', stepId: TestTour.EMAIL}));
    expect(result.current.currentStepId).toBe(TestTour.EMAIL);
    act(() => result.current.dispatch({type: 'END_TOUR'}));
    expect(result.current.currentStepId).toBeNull();
  });

  it('navigates to the next step correctly', () => {
    const result = registerAllSteps();
    expect(result.current.currentStepId).toBeNull();
    act(() => result.current.dispatch({type: 'NEXT_STEP'}));
    expect(result.current.currentStepId).toBeNull();
    act(() => result.current.dispatch({type: 'START_TOUR'}));
    expect(result.current.currentStepId).toBe(TestTour.NAME);
    act(() => result.current.dispatch({type: 'NEXT_STEP'}));
    expect(result.current.currentStepId).toBe(TestTour.EMAIL);
    act(() => result.current.dispatch({type: 'NEXT_STEP'}));
    expect(result.current.currentStepId).toBe(TestTour.PASSWORD);
    act(() => result.current.dispatch({type: 'NEXT_STEP'}));
    expect(result.current.currentStepId).toBeNull();
  });

  it('navigates to the previous step correctly', () => {
    const result = registerAllSteps();
    expect(result.current.currentStepId).toBeNull();
    act(() => result.current.dispatch({type: 'PREVIOUS_STEP'}));
    expect(result.current.currentStepId).toBeNull();
    act(() => result.current.dispatch({type: 'START_TOUR', stepId: TestTour.PASSWORD}));
    expect(result.current.currentStepId).toBe(TestTour.PASSWORD);
    act(() => result.current.dispatch({type: 'PREVIOUS_STEP'}));
    expect(result.current.currentStepId).toBe(TestTour.EMAIL);
    act(() => result.current.dispatch({type: 'PREVIOUS_STEP'}));
    expect(result.current.currentStepId).toBe(TestTour.NAME);
    act(() => result.current.dispatch({type: 'PREVIOUS_STEP'}));
    expect(result.current.currentStepId).toBe(TestTour.NAME);
  });

  it('sets the step correctly', () => {
    const result = registerAllSteps();
    expect(result.current.currentStepId).toBeNull();
    act(() => result.current.dispatch({type: 'SET_STEP', stepId: TestTour.EMAIL}));
    expect(result.current.currentStepId).toBe(TestTour.EMAIL);
    act(() => result.current.dispatch({type: 'SET_STEP', stepId: TestTour.PASSWORD}));
    expect(result.current.currentStepId).toBe(TestTour.PASSWORD);
    act(() => result.current.dispatch({type: 'SET_STEP', stepId: TestTour.NAME}));
    expect(result.current.currentStepId).toBe(TestTour.NAME);
  });
});
