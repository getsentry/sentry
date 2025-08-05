import {render, screen} from 'sentry-test/reactTestingLibrary';

import RepoTokenTable, {DEFAULT_SORT} from './repoTokenTable';

jest.mock('sentry/actionCreators/modal', () => ({
  openTokenRegenerationConfirmationModal: jest.fn(),
}));

jest.mock('sentry/components/confirm', () => {
  return function MockConfirm({children}: {children: React.ReactNode}) {
    return <div>{children}</div>;
  };
});

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
  sort: DEFAULT_SORT,
};

describe('RepoTokenTable', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders table with repository tokens data', () => {
    render(<RepoTokenTable {...defaultProps} />);

    expect(screen.getByLabelText('Repository Tokens Table')).toBeInTheDocument();

    // Check table headers
    expect(screen.getByText('Repository Name')).toBeInTheDocument();
    expect(screen.getByText('Token')).toBeInTheDocument();

    // Check table data
    expect(screen.getByText('sentry-frontend')).toBeInTheDocument();
    expect(screen.getByText('sentry-backend')).toBeInTheDocument();
    expect(screen.getByText('sk_test_token_12345abcdef')).toBeInTheDocument();
    expect(screen.getByText('sk_test_token_67890ghijkl')).toBeInTheDocument();

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

    render(<RepoTokenTable {...emptyProps} />);

    expect(screen.getByLabelText('Repository Tokens Table')).toBeInTheDocument();
    expect(screen.getByText('Repository Name')).toBeInTheDocument();
    expect(screen.getByText('Token')).toBeInTheDocument();

    // Should not have any repository data
    expect(screen.queryByText('sentry-frontend')).not.toBeInTheDocument();
    expect(screen.queryByText('sentry-backend')).not.toBeInTheDocument();
  });

  it('renders table with single repository token', () => {
    const singleDataProps = {
      ...defaultProps,
      response: {
        data: [mockData[0]!],
        isLoading: false,
        error: null,
      },
    };

    render(<RepoTokenTable {...singleDataProps} />);

    expect(screen.getByText('sentry-frontend')).toBeInTheDocument();
    expect(screen.getByText('sk_test_token_12345abcdef')).toBeInTheDocument();
    expect(screen.queryByText('sentry-backend')).not.toBeInTheDocument();

    const regenerateButtons = screen.getAllByText('Regenerate token');
    expect(regenerateButtons).toHaveLength(1);
  });

  it('renders regenerate buttons that can be interacted with', () => {
    render(<RepoTokenTable {...defaultProps} />);

    const regenerateButtons = screen.getAllByText('Regenerate token');
    expect(regenerateButtons).toHaveLength(2);

    // Check that buttons are clickable
    regenerateButtons.forEach(button => {
      expect(button.closest('button')).toBeEnabled();
    });
  });
});
