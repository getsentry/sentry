import {ApiTokenFixture} from 'sentry-fixture/apiToken';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ApiTokenDetails from 'sentry/views/settings/account/apiTokenDetails';

describe('ApiNewToken', function () {
  it('renders', function () {
    const token1 = ApiTokenFixture({id: '1', name: 'token1'});

    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/api-tokens/1/`,
      body: token1,
    });
    render(<ApiTokenDetails params={{tokenId: '1'}} />);
  });

  it('renames token to new name', async function () {
    MockApiClient.clearMockResponses();

    const mock1 = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/api-tokens/1/`,
      body: ApiTokenFixture({id: '1', name: 'token1'}),
    });

    render(<ApiTokenDetails params={{tokenId: '1'}} />);

    await waitFor(() => expect(mock1).toHaveBeenCalledTimes(1));

    const assignMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/api-tokens/1/`,
    });

    await userEvent.type(screen.getByLabelText('Name'), ' new');

    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    await waitFor(() =>
      expect(assignMock).toHaveBeenCalledWith(
        '/api-tokens/1/',
        expect.objectContaining({
          method: 'PUT',
          data: expect.objectContaining({
            name: 'token1 new',
          }),
        })
      )
    );
  });

  it('removes token name', async function () {
    MockApiClient.clearMockResponses();

    const mock1 = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/api-tokens/1/`,
      body: ApiTokenFixture({id: '1', name: 'token1'}),
    });

    render(<ApiTokenDetails params={{tokenId: '1'}} />);

    await waitFor(() => expect(mock1).toHaveBeenCalledTimes(1));

    const assignMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/api-tokens/1/`,
    });

    await userEvent.clear(screen.getByRole('textbox', {name: /name/i}));

    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    await waitFor(() =>
      expect(assignMock).toHaveBeenCalledWith(
        '/api-tokens/1/',
        expect.objectContaining({
          method: 'PUT',
          data: expect.objectContaining({
            name: '',
          }),
        })
      )
    );
  });
});
