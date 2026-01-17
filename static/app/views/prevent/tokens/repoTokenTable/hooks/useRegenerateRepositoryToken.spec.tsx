import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openTokenRegenerationConfirmationModal} from 'sentry/actionCreators/modal';
import {QueryClientProvider} from 'sentry/utils/queryClient';

import {useRegenerateRepositoryToken} from './useRegenerateRepositoryToken';

jest.mock('sentry/actionCreators/indicator');
jest.mock('sentry/actionCreators/modal');

const mockAddSuccessMessage = jest.mocked(addSuccessMessage);
const mockAddErrorMessage = jest.mocked(addErrorMessage);
const mockOpenTokenRegenerationConfirmationModal = jest.mocked(
  openTokenRegenerationConfirmationModal
);

describe('useRegenerateRepositoryToken', () => {
  let queryClient: ReturnType<typeof makeTestQueryClient>;

  beforeEach(() => {
    queryClient = makeTestQueryClient();
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  const wrapper = ({children}: {children: React.ReactNode}) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const mockVariables = {
    orgSlug: 'test-org',
    integratedOrgId: 'integrated-123',
    repository: 'test-repo',
  };

  it('successfully regenerates token and shows success message', async () => {
    const mockToken = 'new-token-12345';
    const mockResponse = MockApiClient.addMockResponse({
      url: `/organizations/${mockVariables.orgSlug}/prevent/owner/${mockVariables.integratedOrgId}/repository/${mockVariables.repository}/token/regenerate/`,
      method: 'POST',
      body: {token: mockToken},
    });

    const {result} = renderHook(useRegenerateRepositoryToken, {wrapper});

    result.current.mutate(mockVariables);

    await waitFor(() => {
      expect(mockResponse).toHaveBeenCalledWith(
        `/organizations/${mockVariables.orgSlug}/prevent/owner/${mockVariables.integratedOrgId}/repository/${mockVariables.repository}/token/regenerate/`,
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    expect(mockAddSuccessMessage).toHaveBeenCalledWith('Token regenerated successfully.');
    expect(mockOpenTokenRegenerationConfirmationModal).toHaveBeenCalledWith({
      token: mockToken,
    });
  });

  it('handles API errors and shows error message', async () => {
    const mockResponse = MockApiClient.addMockResponse({
      url: `/organizations/${mockVariables.orgSlug}/prevent/owner/${mockVariables.integratedOrgId}/repository/${mockVariables.repository}/token/regenerate/`,
      method: 'POST',
      statusCode: 500,
      body: {detail: 'Internal server error'},
    });

    const {result} = renderHook(useRegenerateRepositoryToken, {wrapper});

    result.current.mutate(mockVariables);

    await waitFor(() => {
      expect(mockResponse).toHaveBeenCalled();
    });

    expect(mockAddErrorMessage).toHaveBeenCalledWith('Failed to regenerate token.');
    expect(mockAddSuccessMessage).not.toHaveBeenCalled();
    expect(mockOpenTokenRegenerationConfirmationModal).not.toHaveBeenCalled();
  });

  it('invalidates the correct query on successful regeneration', async () => {
    const mockToken = 'new-token-12345';
    MockApiClient.addMockResponse({
      url: `/organizations/${mockVariables.orgSlug}/prevent/owner/${mockVariables.integratedOrgId}/repository/${mockVariables.repository}/token/regenerate/`,
      method: 'POST',
      body: {token: mockToken},
    });

    const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const {result} = renderHook(useRegenerateRepositoryToken, {wrapper});

    result.current.mutate(mockVariables);

    await waitFor(() => {
      expect(mockAddSuccessMessage).toHaveBeenCalled();
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: [
        `/organizations/${mockVariables.orgSlug}/prevent/owner/${mockVariables.integratedOrgId}/repositories/tokens/`,
      ],
    });
  });
});
