import {createContext, useContext} from 'react';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {
  TourContextProvider,
  TourElement,
  type TourElementProps,
} from 'sentry/components/tours/components';
import {type TourContextType, useTourReducer} from 'sentry/components/tours/tourContext';

const enum TestTour {
  NAME = 'test-tour-name',
  EMAIL = 'test-tour-email',
  PASSWORD = 'test-tour-password',
}
const ORDERED_TEST_TOUR = [TestTour.NAME, TestTour.EMAIL, TestTour.PASSWORD];
const TestTourContext = createContext<TourContextType<TestTour>>({
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
function TestTourElement(props: TourElementProps<TestTour>) {
  const tourContext = useTestTour();
  return <TourElement tourContext={tourContext} {...props} />;
}

const emptyTourContext = {
  currentStepId: null,
  isAvailable: true,
  isRegistered: false,
  orderedStepIds: [],
  dispatch: jest.fn(),
  handleStepRegistration: jest.fn(),
};

jest.mock('sentry/components/tours/tourContext', () => ({
  useTourReducer: jest.fn(),
}));

const mockUseTourReducer = jest.mocked(useTourReducer);

describe('Tour Components', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TourContextProvider', () => {
    it('renders children regardless of availability', () => {
      mockUseTourReducer.mockReturnValue(emptyTourContext);

      const {container: availableContainer} = render(
        <TourContextProvider
          isAvailable
          orderedStepIds={ORDERED_TEST_TOUR}
          tourContext={TestTourContext}
        >
          <div>Child Content</div>
        </TourContextProvider>
      );
      expect(within(availableContainer).getByText('Child Content')).toBeInTheDocument();

      const {container: unavailableContainer} = render(
        <TourContextProvider
          isAvailable={false}
          orderedStepIds={ORDERED_TEST_TOUR}
          tourContext={TestTourContext}
        >
          <div>Child Content</div>
        </TourContextProvider>
      );
      expect(within(unavailableContainer).getByText('Child Content')).toBeInTheDocument();
    });

    it('does render blur based on omitBlur', () => {
      mockUseTourReducer.mockReturnValue({
        ...emptyTourContext,
        isRegistered: true,
        currentStepId: TestTour.NAME,
      });
      const {container: blurContainer} = render(
        <TourContextProvider
          orderedStepIds={ORDERED_TEST_TOUR}
          isAvailable
          tourContext={TestTourContext}
        >
          <div>Child Content</div>
        </TourContextProvider>
      );
      expect(within(blurContainer).getByTestId('tour-blur-window')).toBeInTheDocument();

      const {container: noBlurContainer} = render(
        <TourContextProvider
          orderedStepIds={ORDERED_TEST_TOUR}
          isAvailable
          tourContext={TestTourContext}
          omitBlur
        >
          <div>Child Content</div>
        </TourContextProvider>
      );
      expect(
        within(noBlurContainer).queryByTestId('tour-blur-window')
      ).not.toBeInTheDocument();
    });
  });

  describe('TourElement', () => {
    it('renders children regardless of tour state', async () => {
      mockUseTourReducer.mockReturnValue(emptyTourContext);
      const {container: inactiveContainer} = render(
        <TourElement<TestTour>
          id={TestTour.NAME}
          title="Test Title"
          description="Test Description"
          tourContext={emptyTourContext}
        >
          <div>Child Element</div>
        </TourElement>
      );

      expect(within(inactiveContainer).getByText('Child Element')).toBeInTheDocument();

      const {container: activeContainer} = render(
        <TourElement<TestTour>
          id={TestTour.NAME}
          title="Test Title"
          description="Test Description"
          tourContext={{
            ...emptyTourContext,
            orderedStepIds: ORDERED_TEST_TOUR,
            isRegistered: true,
            currentStepId: TestTour.NAME,
          }}
        >
          <div>Child Element</div>
        </TourElement>
      );
      expect(await within(activeContainer).findByText('Test Title')).toBeInTheDocument();
      expect(within(activeContainer).getByText('Child Element')).toBeInTheDocument();
    });

    it('renders overlay when step is active', async () => {
      const {unmount: unmountFirstStep} = render(
        <TourElement<TestTour>
          id={TestTour.NAME}
          title="Test Title"
          description="Test Description"
          tourContext={{
            ...emptyTourContext,
            orderedStepIds: ORDERED_TEST_TOUR,
            isRegistered: true,
            currentStepId: TestTour.NAME,
          }}
        >
          <div>Child Element</div>
        </TourElement>
      );

      expect(await screen.findByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test Description')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Close'})).toBeInTheDocument();

      expect(screen.getByText('1/3')).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Previous'})).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Finish tour'})).not.toBeInTheDocument();

      unmountFirstStep();

      const {unmount: unmountSecondStep} = render(
        <TourElement<TestTour>
          id={TestTour.EMAIL}
          title="Test Title"
          description="Test Description"
          tourContext={{
            ...emptyTourContext,
            orderedStepIds: ORDERED_TEST_TOUR,
            isRegistered: true,
            currentStepId: TestTour.EMAIL,
          }}
        >
          <div>Child Element</div>
        </TourElement>
      );

      expect(await screen.findByText('2/3')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Previous'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Finish tour'})).not.toBeInTheDocument();

      unmountSecondStep();

      render(
        <TourElement<TestTour>
          id={TestTour.PASSWORD}
          title="Test Title"
          description="Test Description"
          tourContext={{
            ...emptyTourContext,
            orderedStepIds: ORDERED_TEST_TOUR,
            isRegistered: true,
            currentStepId: TestTour.PASSWORD,
          }}
        >
          <div>Child Element</div>
        </TourElement>
      );

      expect(await screen.findByText('3/3')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Previous'})).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Next'})).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Finish tour'})).toBeInTheDocument();
    });

    it('handles registration of the tour steps', () => {
      const mockHandleStepRegistration = jest.fn();
      mockUseTourReducer.mockReturnValue({
        ...emptyTourContext,
        handleStepRegistration: mockHandleStepRegistration,
      });
      render(
        <TourContextProvider
          isAvailable
          orderedStepIds={ORDERED_TEST_TOUR}
          tourContext={TestTourContext}
        >
          <TestTourElement id={TestTour.NAME} title="Name" description="The name">
            Name
          </TestTourElement>
          <TestTourElement id={TestTour.EMAIL} title="Email" description="The email">
            Email
          </TestTourElement>
          <TestTourElement
            id={TestTour.PASSWORD}
            title="Password"
            description="The password"
          >
            Password
          </TestTourElement>
        </TourContextProvider>
      );
      expect(mockHandleStepRegistration).toHaveBeenCalledWith({
        id: TestTour.NAME,
        element: expect.any(HTMLElement),
      });
      expect(mockHandleStepRegistration).toHaveBeenCalledWith({
        id: TestTour.EMAIL,
        element: expect.any(HTMLElement),
      });
      expect(mockHandleStepRegistration).toHaveBeenCalledWith({
        id: TestTour.PASSWORD,
        element: expect.any(HTMLElement),
      });
    });
  });
});
