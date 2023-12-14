import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import ExternalRedirect from 'sentry/views/externalRedirect';

jest.mock('sentry/utils/useLocation', () => ({
  useLocation: jest.fn(),
}));

const mockedUseLocation = jest.requireMock('sentry/utils/useLocation').useLocation;

describe('ExternalRedirect', () => {
  let originalHref;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    originalHref = window.location.href;
    Object.defineProperty(window.location, 'href', {
      writable: true,
      value: 'http://initial-url.com',
    });
  });

  afterEach(() => {
    Object.defineProperty(window.location, 'href', {
      writable: true,
      value: originalHref,
    });
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

  // it('renders correctly with an invalid URL', () => {
  //   const testUrl = 'bad://test-url.com';
  //   mockedUseLocation.mockReturnValue({query: {url: testUrl}});
  //   render(<ExternalRedirect />);

  //   // Ensure url is rendered on the redirect page
  //   expect(screen.getByText('Error: Invalid URL')).toBeInTheDocument();

  //   act(() => {
  //     jest.advanceTimersByTime(5000);
  //   });

  //   // expect(window).toBeNull();
  // });

  // Other tests...
});
