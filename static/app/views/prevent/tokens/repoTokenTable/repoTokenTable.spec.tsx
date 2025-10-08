import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import PreventQueryParamsProvider from 'sentry/components/prevent/container/preventParamsProvider';
import localStorageWrapper from 'sentry/utils/localStorage';

import RepoTokenTable from './repoTokenTable';

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
};

describe('RepoTokenTable', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();

    localStorageWrapper.clear();

    localStorageWrapper.setItem(
      'prevent-selection:org-slug',
      JSON.stringify({
        'integrated-name': {
          integratedOrgId: 'integrated-123',
        },
      })
    );
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
              integratedOrgName: 'integrated-name',
            },
          },
        },
      }
    );
  };

  it('renders table with repository tokens data', () => {
    renderWithContext();

    expect(screen.getByText('Repository name')).toBeInTheDocument();
    expect(screen.getByText('Token')).toBeInTheDocument();

    expect(screen.getByText('sentry-frontend')).toBeInTheDocument();
    expect(screen.getByText('sentry-backend')).toBeInTheDocument();
    expect(screen.getByDisplayValue('sk_test_token_12345abcdef')).toBeInTheDocument();
    expect(screen.getByDisplayValue('sk_test_token_67890ghijkl')).toBeInTheDocument();

    const regenerateButtons = screen.getAllByRole('button', {name: 'Regenerate token'});
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

    expect(screen.getByText('Repository name')).toBeInTheDocument();
    expect(screen.getByText('Token')).toBeInTheDocument();
    expect(screen.getByText('No repository tokens found')).toBeInTheDocument();
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

    const regenerateButtons = screen.getAllByRole('button', {name: 'Regenerate token'});
    expect(regenerateButtons).toHaveLength(2);
    await userEvent.click(regenerateButtons[0]!);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    const confirmButton = await screen.findByRole('button', {name: 'Generate new token'});
    await userEvent.click(confirmButton);

    expect(mockResponse).toHaveBeenCalled();

    expect(
      await screen.findByRole('heading', {name: 'Token created'})
    ).toBeInTheDocument();

    expect(screen.getByDisplayValue(mockToken)).toBeInTheDocument();
  });
});
