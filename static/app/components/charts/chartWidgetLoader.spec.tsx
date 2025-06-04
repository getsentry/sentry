import * as Sentry from '@sentry/core';
import {
  QueryClient,
  QueryClientProvider,
  type UseQueryOptions,
} from '@tanstack/react-query';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ChartId} from './chartWidgetLoader';
import {ChartWidgetLoader} from './chartWidgetLoader';

const mockUseQuery = jest.fn();
jest.mock('@sentry/core', () => ({
  ...jest.requireActual('@sentry/core'),
  captureException: jest.fn(),
}));
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQuery: (options: UseQueryOptions) => mockUseQuery(options),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({children}: {children: React.ReactNode}) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('ChartWidgetLoader', () => {
  beforeEach(() => {
    mockUseQuery.mockClear();
    queryClient.clear();
    jest.spyOn(Sentry, 'captureException').mockImplementation(() => '123');
  });

  const defaultProps = {
    id: 'test-widget' as ChartId,
    height: '200px',
  };

  it('renders loading state', () => {
    mockUseQuery.mockReturnValue({
      isPending: true,
      isError: false,
      data: undefined,
    });

    render(<ChartWidgetLoader {...defaultProps} />, {wrapper});
    expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument(); // Placeholder component
  });

  it('renders error state when widget import fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    mockUseQuery.mockReturnValue({
      isPending: false,
      isError: true,
      error: new Error('Failed to load widget'),
      data: undefined,
    });

    render(<ChartWidgetLoader {...defaultProps} />, {wrapper});

    await waitFor(() => {
      expect(screen.getByText('Error loading widget')).toBeInTheDocument();
    });

    expect(Sentry.captureException).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('renders the widget component when loaded successfully', async () => {
    function MockWidget() {
      return <div data-test-id="mock-widget">Mock Widget</div>;
    }

    mockUseQuery.mockReturnValue({
      isPending: false,
      isError: false,
      data: {default: MockWidget},
    });

    render(<ChartWidgetLoader {...defaultProps} />, {wrapper});

    await waitFor(() => {
      expect(screen.getByText('Mock Widget')).toBeInTheDocument();
    });

    // Verify the query was called with correct parameters
    expect(mockUseQuery).toHaveBeenCalledWith({
      queryKey: [`widget-${defaultProps.id}`],
      queryFn: expect.any(Function),
    });
  });
});
