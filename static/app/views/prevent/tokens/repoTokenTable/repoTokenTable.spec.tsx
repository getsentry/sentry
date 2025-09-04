import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {openTokenRegenerationConfirmationModal} from 'sentry/actionCreators/modal';
import PreventQueryParamsProvider from 'sentry/components/prevent/container/preventParamsProvider';

import RepoTokenTable, {type ValidSort} from './repoTokenTable';

jest.mock('sentry/actionCreators/modal');
jest.mock('sentry/components/confirm', () => {
  return function MockConfirm({onConfirm, children}: any) {
    return (
      <div>
        {children}
        <button onClick={onConfirm}>Generate new token</button>
      </div>
    );
  };
});

const mockOpenTokenRegenerationConfirmationModal = jest.mocked(
  openTokenRegenerationConfirmationModal
);

const mockData = [
  {
    name: 'sentry-frontend',
    token: 'sk_test_token_12345abcdef',
  },
  {
    name: 'sentry-backend',
    token: 'sk_test_token_67890ghijkl',
  },
];

const defaultProps = {
  response: {
    data: mockData,
    isLoading: false,
    error: null,
  },
  sort: {field: 'name', kind: 'desc'} as ValidSort,
};

describe('RepoTokenTable', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  const renderWithContext = (props = defaultProps) => {
    return render(
      <PreventQueryParamsProvider>
        <RepoTokenTable {...props} />
      </PreventQueryParamsProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/prevent/tokens/',
            query: {
              integratedOrgId: 'integrated-123',
            },
          },
        },
      }
    );
  };

  it('renders table with repository tokens data', () => {
    renderWithContext();

    expect(screen.getByLabelText('Repository Tokens Table')).toBeInTheDocument();

    // Check table headers
    expect(screen.getByText('Repository Name')).toBeInTheDocument();
    expect(screen.getByText('Token')).toBeInTheDocument();

    // Check table data
    expect(screen.getByText('sentry-frontend')).toBeInTheDocument();
    expect(screen.getByText('sentry-backend')).toBeInTheDocument();
    expect(screen.getByDisplayValue('sk_test_token_12345abcdef')).toBeInTheDocument();
    expect(screen.getByDisplayValue('sk_test_token_67890ghijkl')).toBeInTheDocument();

    // Check regenerate buttons
    const regenerateButtons = screen.getAllByText('Regenerate token');
    expect(regenerateButtons).toHaveLength(2);
  });

  it('renders empty table when no data is provided', () => {
    const emptyProps = {
      ...defaultProps,
      response: {
        data: [],
        isLoading: false,
        error: null,
      },
    };

    renderWithContext(emptyProps);

    expect(screen.getByLabelText('Repository Tokens Table')).toBeInTheDocument();
    expect(screen.getByText('Repository Name')).toBeInTheDocument();
    expect(screen.getByText('Token')).toBeInTheDocument();

    // Should not have any repository data
    expect(screen.queryByText('sentry-frontend')).not.toBeInTheDocument();
    expect(screen.queryByText('sentry-backend')).not.toBeInTheDocument();
  });

  it('calls regenerate token hook and opens modal on successful token regeneration', async () => {
    const mockToken = 'new-regenerated-token-12345';
    const mockResponse = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prevent/owner/integrated-123/repository/sentry-frontend/token/regenerate/',
      method: 'POST',
      body: {token: mockToken},
    });

    renderWithContext();
    renderGlobalModal();

    // Click the regenerate button for the first repository to open the confirmation
    const regenerateButtons = screen.getAllByRole('button', {name: 'regenerate token'});
    expect(regenerateButtons).toHaveLength(2);
    await userEvent.click(regenerateButtons[0]!);

    // Click the confirm button from the mocked Confirm component
    const confirmButtons = screen.getAllByRole('button', {name: 'Generate new token'});
    await userEvent.click(confirmButtons[0]!);

    // Wait for the API call to complete
    await waitFor(() => {
      expect(mockResponse).toHaveBeenCalledWith(
        '/organizations/org-slug/prevent/owner/integrated-123/repository/sentry-frontend/token/regenerate/',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    // Verify that the modal is opened with the correct token
    expect(mockOpenTokenRegenerationConfirmationModal).toHaveBeenCalledWith({
      token: mockToken,
    });
  });

  describe('Sorting functionality', () => {
    it('renders with sort indicators when sort is provided', () => {
      const sortedProps = {
        ...defaultProps,
        sort: {field: 'name', kind: 'desc'} as const,
      };

      renderWithContext(sortedProps);

      // Check for sort arrow specifically in the Repository Name column header
      const nameHeader = screen.getAllByRole('columnheader', {
        name: /repository name/i,
      })[1];
      expect(nameHeader.querySelector('svg')).toBeInTheDocument();
      expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
    });

    it('renders without sort indicators when no sort is provided', () => {
      const unsortedProps = {
        ...defaultProps,
        sort: undefined as unknown as ValidSort,
      };

      renderWithContext(unsortedProps);

      // Check that there's no sort arrow in the Repository Name column header
      const nameHeader = screen.getAllByRole('columnheader', {
        name: /repository name/i,
      })[1];
      expect(nameHeader.querySelector('svg')).not.toBeInTheDocument();
      expect(nameHeader).toHaveAttribute('aria-sort', 'none');
    });

    it('shows ascending sort indicator correctly', () => {
      const ascendingProps = {
        ...defaultProps,
        sort: {field: 'name', kind: 'asc'} as const,
      };

      renderWithContext(ascendingProps);

      // Check for sort arrow specifically in the Repository Name column header
      const nameHeader = screen.getAllByRole('columnheader', {
        name: /repository name/i,
      })[1];
      expect(nameHeader.querySelector('svg')).toBeInTheDocument();
      expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    });

    it('makes repository name column clickable for sorting', () => {
      const unsortedProps = {
        ...defaultProps,
        sort: undefined as unknown as ValidSort,
      };

      renderWithContext(unsortedProps);

      const nameHeader = screen.getAllByRole('columnheader', {
        name: /repository name/i,
      })[1];
      expect(nameHeader).toHaveAttribute('href');
      expect(nameHeader).toHaveAttribute('href', expect.stringContaining('sort=name'));
    });

    it('does not make token column clickable', () => {
      renderWithContext();

      const tokenHeader = screen.getByText('Token');
      expect(tokenHeader.tagName).toBe('SPAN');
      expect(tokenHeader).not.toHaveAttribute('href');
    });
  });
});
