import {ApiApplicationFixture} from 'sentry-fixture/apiApplication';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import AccountAuthorizations from 'sentry/views/settings/account/accountAuthorizations';

describe('AccountAuthorizations', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders empty', async function () {
    MockApiClient.addMockResponse({
      url: '/api-authorizations/',
      method: 'GET',
      body: [],
    });

    render(<AccountAuthorizations />);
    expect(
      await screen.findByText("You haven't approved any third party applications.")
    ).toBeInTheDocument();
  });

  it('revokes authorizations correctly', async function () {
    MockApiClient.addMockResponse({
      url: '/api-authorizations/',
      method: 'GET',
      body: [
        {
          application: ApiApplicationFixture({name: 'Delete Shrimp'}),
          homepageUrl: 'test.com',
          id: 'delete_shrimp',
          scopes: [],
        },
        {
          application: ApiApplicationFixture({name: 'Keep Shrimp'}),
          homepageUrl: 'test2.com',
          id: 'keep_shrimp',
          scopes: [],
        },
      ],
    });
    const deleteMock = MockApiClient.addMockResponse({
      url: '/api-authorizations/',
      method: 'DELETE',
    });

    render(<AccountAuthorizations />);
    expect(await screen.findByText('Delete Shrimp')).toBeInTheDocument();
    expect(await screen.findByText('Keep Shrimp')).toBeInTheDocument();

    // delete the 'Detete Shrimp' authorization
    await userEvent.click(screen.getByTestId('delete_shrimp'));

    expect(deleteMock).toHaveBeenCalledWith(
      '/api-authorizations/',
      expect.objectContaining({
        method: 'DELETE',
        data: {authorization: 'delete_shrimp'},
      })
    );

    await waitFor(() =>
      expect(screen.queryByText('Delete Shrimp')).not.toBeInTheDocument()
    );
    await screen.findByText('Keep Shrimp');
  });
});
