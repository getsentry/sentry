import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  TourAction,
  TourContextProvider,
  TourElement,
  TourGuide,
} from 'sentry/components/tours/components';
import {
  emptyTourContext,
  ORDERED_TEST_TOUR,
  TestTour,
  TestTourContext,
} from 'sentry/components/tours/testUtils';
import {useTourReducer} from 'sentry/components/tours/tourContext';

jest.mock('sentry/components/tours/tourContext', () => ({
  useTourReducer: jest.fn(),
}));

const mockUseTourReducer = jest.mocked(useTourReducer);

describe('Tour Components', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TourContextProvider', () => {
    it('renders children regardless of completion', () => {
      mockUseTourReducer.mockReturnValue(emptyTourContext);
      render(
        <TourContextProvider<TestTour>
          isCompleted
          orderedStepIds={ORDERED_TEST_TOUR}
          TourContext={TestTourContext}
        >
          <div>Child Content</div>
        </TourContextProvider>
      );
      expect(screen.getByText('Child Content')).toBeInTheDocument();
    });

    it('just updates the assistant when opened', async () => {
      const tourKey = 'test-tour';
      const mockMutateAssistant = MockApiClient.addMockResponse({
        url: '/assistant/',
        method: 'PUT',
      });
      mockUseTourReducer.mockReturnValue({
        ...emptyTourContext,
        tourKey,
        isRegistered: true,
        currentStepId: TestTour.NAME,
      });
      render(
        <TourContextProvider<TestTour>
          tourKey={tourKey}
          isCompleted={false}
          orderedStepIds={ORDERED_TEST_TOUR}
          TourContext={TestTourContext}
        >
          <div>Child Content</div>
        </TourContextProvider>
      );

      expect(await screen.findByTestId('tour-blur-window')).toBeInTheDocument();
      expect(mockMutateAssistant).toHaveBeenCalledWith(
        '/assistant/',
        expect.objectContaining({data: {guide: tourKey, status: 'viewed'}})
      );
    });
  });

  describe('TourElement', () => {
    it('renders children regardless of tour state', async () => {
      mockUseTourReducer.mockReturnValue(emptyTourContext);
      const {unmount: unmountInactive} = render(
        <TourContextProvider<TestTour>
          isCompleted={false}
          orderedStepIds={ORDERED_TEST_TOUR}
          TourContext={TestTourContext}
        >
          <TourElement<TestTour>
            id={TestTour.NAME}
            title="Test Title"
            description="Test Description"
            tourContext={TestTourContext}
          >
            <div>Child Element</div>
          </TourElement>
        </TourContextProvider>
      );

      expect(screen.getByText('Child Element')).toBeInTheDocument();
      unmountInactive();

      mockUseTourReducer.mockReturnValue({
        ...emptyTourContext,
        isRegistered: true,
        currentStepId: TestTour.NAME,
      });
      render(
        <TourContextProvider<TestTour>
          isCompleted={false}
          orderedStepIds={ORDERED_TEST_TOUR}
          TourContext={TestTourContext}
        >
          <TourElement<TestTour>
            id={TestTour.NAME}
            title="Test Title"
            description="Test Description"
            tourContext={TestTourContext}
          >
            <div>Child Element</div>
          </TourElement>
        </TourContextProvider>
      );
      expect(await screen.findByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Child Element')).toBeInTheDocument();
    });

    it('renders overlay when step is active', async () => {
      mockUseTourReducer.mockReturnValue({
        ...emptyTourContext,
        orderedStepIds: ORDERED_TEST_TOUR,
        isRegistered: true,
        currentStepId: TestTour.NAME,
      });
      const {unmount: unmountFirstStep} = render(
        <TourContextProvider<TestTour>
          isCompleted={false}
          orderedStepIds={ORDERED_TEST_TOUR}
          TourContext={TestTourContext}
        >
          <TourElement<TestTour>
            id={TestTour.NAME}
            title="Test Title"
            description="Test Description"
            tourContext={TestTourContext}
          >
            <div>Child Element</div>
          </TourElement>
        </TourContextProvider>
      );

      expect(await screen.findByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test Description')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Close'})).toBeInTheDocument();

      expect(screen.getByText('1/3')).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Previous'})).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Finish tour'})).not.toBeInTheDocument();

      unmountFirstStep();
      mockUseTourReducer.mockReturnValue({
        ...emptyTourContext,
        orderedStepIds: ORDERED_TEST_TOUR,
        isRegistered: true,
        currentStepId: TestTour.EMAIL,
      });

      const {unmount: unmountSecondStep} = render(
        <TourContextProvider<TestTour>
          isCompleted={false}
          orderedStepIds={ORDERED_TEST_TOUR}
          TourContext={TestTourContext}
        >
          <TourElement<TestTour>
            id={TestTour.EMAIL}
            title="Test Title"
            description="Test Description"
            tourContext={TestTourContext}
          >
            <div>Child Element</div>
          </TourElement>
        </TourContextProvider>
      );

      expect(await screen.findByText('2/3')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Previous'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Finish tour'})).not.toBeInTheDocument();

      unmountSecondStep();
      mockUseTourReducer.mockReturnValue({
        ...emptyTourContext,
        orderedStepIds: ORDERED_TEST_TOUR,
        isRegistered: true,
        currentStepId: TestTour.PASSWORD,
      });

      render(
        <TourContextProvider<TestTour>
          isCompleted={false}
          orderedStepIds={ORDERED_TEST_TOUR}
          TourContext={TestTourContext}
        >
          <TourElement<TestTour>
            id={TestTour.PASSWORD}
            title="Test Title"
            description="Test Description"
            tourContext={TestTourContext}
          >
            <div>Child Element</div>
          </TourElement>
        </TourContextProvider>
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
        <TourContextProvider<TestTour>
          isCompleted={false}
          orderedStepIds={ORDERED_TEST_TOUR}
          TourContext={TestTourContext}
        >
          <TourElement<TestTour>
            tourContext={TestTourContext}
            id={TestTour.NAME}
            title="Name"
            description="The name"
          >
            Name
          </TourElement>
          <TourElement<TestTour>
            tourContext={TestTourContext}
            id={TestTour.EMAIL}
            title="Email"
            description="The email"
          >
            Email
          </TourElement>
          <TourElement<TestTour>
            tourContext={TestTourContext}
            id={TestTour.PASSWORD}
            title="Password"
            description="The password"
          >
            Password
          </TourElement>
        </TourContextProvider>
      );
      expect(mockHandleStepRegistration).toHaveBeenCalledWith({id: TestTour.NAME});
      expect(mockHandleStepRegistration).toHaveBeenCalledWith({id: TestTour.EMAIL});
      expect(mockHandleStepRegistration).toHaveBeenCalledWith({id: TestTour.PASSWORD});
    });

    it('just updates the assistant when dismissed', async () => {
      const tourKey = 'test-tour';
      const mockMutateAssistant = MockApiClient.addMockResponse({
        url: '/assistant/',
        method: 'PUT',
      });
      mockUseTourReducer.mockReturnValue({
        ...emptyTourContext,
        tourKey,
        orderedStepIds: ORDERED_TEST_TOUR,
        isRegistered: true,
        currentStepId: TestTour.NAME,
      });
      render(
        <TourContextProvider<TestTour>
          tourKey={tourKey}
          isCompleted={false}
          orderedStepIds={ORDERED_TEST_TOUR}
          TourContext={TestTourContext}
        >
          <TourElement<TestTour>
            tourContext={TestTourContext}
            id={TestTour.NAME}
            title="Name"
            description="The name"
          >
            Name
          </TourElement>
        </TourContextProvider>
      );

      await userEvent.click(screen.getByRole('button', {name: 'Close'}));
      expect(mockMutateAssistant).toHaveBeenCalledWith(
        '/assistant/',
        expect.objectContaining({data: {guide: tourKey, status: 'dismissed'}})
      );
    });
  });

  describe('TourGuide', () => {
    it('just renders the children when closed', () => {
      const mockScrollIntoView = jest.fn();
      Element.prototype.scrollIntoView = mockScrollIntoView;

      render(
        <TourGuide
          isOpen={false}
          title="Test Title"
          description="Test Description"
          actions={<TourAction>Test Action</TourAction>}
          handleDismiss={jest.fn()}
          stepCount={50}
          stepTotal={100}
          id="test-id"
        >
          <div>Child Element</div>
        </TourGuide>
      );

      expect(screen.getByText('Child Element')).toBeInTheDocument();
      expect(mockScrollIntoView).not.toHaveBeenCalled();
      expect(screen.queryByText('Test Title')).not.toBeInTheDocument();
    });

    it('renders the content of the tour guide', async () => {
      const mockScrollIntoView = jest.fn();
      const mockHandleDismiss = jest.fn();
      Element.prototype.scrollIntoView = mockScrollIntoView;

      render(
        <TourGuide
          isOpen
          title="Test Title"
          description="Test Description"
          actions={<TourAction>Test Action</TourAction>}
          handleDismiss={mockHandleDismiss}
          stepCount={50}
          stepTotal={100}
          id="test-id"
        >
          <div>Child Element</div>
        </TourGuide>
      );

      expect(await screen.findByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test Description')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Test Action'})).toBeInTheDocument();
      expect(screen.getByText('50/100')).toBeInTheDocument();
      expect(screen.getByText('Child Element')).toBeInTheDocument();
      expect(mockScrollIntoView).toHaveBeenCalledWith({
        block: 'center',
        behavior: 'smooth',
      });
      await userEvent.click(screen.getByRole('button', {name: 'Close'}));
      expect(mockHandleDismiss).toHaveBeenCalled();
    });
  });
});
