import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import useDrawer from 'sentry/components/globalDrawer';
import {AssertionSuggestionsButton} from 'sentry/views/alerts/rules/uptime/assertionSuggestionsButton';

// Only mock the default export (useDrawer), keep GlobalDrawer real
// since the test render wrapper uses it to render children.
jest.mock('sentry/components/globalDrawer', () => {
  const actual = jest.requireActual('sentry/components/globalDrawer');
  return {
    ...actual,
    __esModule: true,
    default: jest.fn(),
  };
});

const mockedUseDrawer = useDrawer as unknown as jest.Mock;

describe('AssertionSuggestionsButton', () => {
  const organization = OrganizationFixture();
  const mockOpenDrawer = jest.fn();
  const mockCloseDrawer = jest.fn();

  const defaultProps = {
    getCurrentAssertion: () => null,
    getFormData: () => ({
      url: 'https://example.com/api/health',
      timeoutMs: 5000,
      method: 'GET',
      headers: [] as Array<[string, string]>,
      body: null,
    }),
    onApplySuggestion: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(indicators, 'addErrorMessage');

    mockedUseDrawer.mockReturnValue({
      openDrawer: mockOpenDrawer,
      closeDrawer: mockCloseDrawer,
      isDrawerOpen: false,
      panelRef: {current: null},
    });
  });

  it('renders the Suggest Assertions button', () => {
    render(<AssertionSuggestionsButton {...defaultProps} />, {organization});

    expect(
      screen.getByRole('button', {name: 'Use AI to suggest assertions based on response'})
    ).toBeInTheDocument();
    expect(screen.getByText('Suggest Assertions')).toBeInTheDocument();
  });

  it('shows error when URL is empty', async () => {
    render(
      <AssertionSuggestionsButton
        {...defaultProps}
        getFormData={() => ({
          url: undefined,
          timeoutMs: 5000,
          method: 'GET',
          headers: [],
          body: null,
        })}
      />,
      {organization}
    );

    await userEvent.click(
      screen.getByRole('button', {name: 'Use AI to suggest assertions based on response'})
    );

    await waitFor(() => {
      expect(indicators.addErrorMessage).toHaveBeenCalledWith('Please enter a URL first');
    });
    expect(mockOpenDrawer).not.toHaveBeenCalled();
  });

  it('calls openDrawer with correct payload when clicked', async () => {
    render(<AssertionSuggestionsButton {...defaultProps} />, {organization});

    await userEvent.click(
      screen.getByRole('button', {name: 'Use AI to suggest assertions based on response'})
    );

    expect(mockOpenDrawer).toHaveBeenCalledTimes(1);
    expect(mockOpenDrawer).toHaveBeenCalledWith(expect.any(Function), {
      ariaLabel: 'AI Assertion Suggestions',
    });
  });

  it('is disabled when drawer is open', () => {
    mockedUseDrawer.mockReturnValue({
      openDrawer: mockOpenDrawer,
      closeDrawer: mockCloseDrawer,
      isDrawerOpen: true,
      panelRef: {current: null},
    });

    render(<AssertionSuggestionsButton {...defaultProps} />, {organization});

    expect(
      screen.getByRole('button', {name: 'Use AI to suggest assertions based on response'})
    ).toBeDisabled();
  });
});
