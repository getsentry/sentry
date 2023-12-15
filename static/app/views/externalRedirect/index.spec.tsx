import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import ExternalRedirect from 'sentry/views/externalRedirect';

jest.mock('sentry/utils/useLocation', () => ({
  useLocation: jest.fn(),
}));

const mockedUseLocation = jest.requireMock('sentry/utils/useLocation').useLocation;

describe('ExternalRedirect', () => {
  let originalClose;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    originalClose = window.close;
    window.close = jest.fn();
  });

  afterEach(() => {
    window.close = originalClose; // Restore the original window.close
    jest.useRealTimers();
  });

  it('should render correctly with a valid URL', () => {
    const testUrl = 'http://test-url.com';
    mockedUseLocation.mockReturnValue({query: {url: testUrl}});
    render(<ExternalRedirect />);

    // Ensure url is rendered on the redirect page
    expect(screen.getByText(testUrl)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(window.location.href).toBe(testUrl);
  });

  it('renders correctly with an invalid URL', () => {
    const testUrl = 'bad://test-url.com';
    const windowCloseSpy = jest.spyOn(window, 'close');
    mockedUseLocation.mockReturnValue({query: {url: testUrl}});
    render(<ExternalRedirect />);

    // Ensure url is rendered on the redirect page
    expect(screen.getByText('Error: Invalid URL')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(windowCloseSpy).toHaveBeenCalled();
  });
});
