import {ApiTokenFixture} from 'sentry-fixture/apiToken';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import ApiTokenDetails from 'sentry/views/settings/account/apiTokenDetails';

describe('ApiNewToken', function () {
  MockApiClient.clearMockResponses();

  it('renders', function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/api-tokens/1/`,
      body: ApiTokenFixture({id: '1', name: 'token1'}),
    });
    render(<ApiTokenDetails params={{tokenId: '1'}} />);
  });

  it('renames token to new name', async function () {
    MockApiClient.clearMockResponses();
    jest.spyOn(indicators, 'addSuccessMessage');

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

    await userEvent.type(screen.getByRole('textbox', {name: /name/i}), ' new');

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

    expect(indicators.addSuccessMessage).toHaveBeenCalled();
  });

  it('removes token name', async function () {
    MockApiClient.clearMockResponses();
    jest.spyOn(indicators, 'addSuccessMessage');

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

    expect(indicators.addSuccessMessage).toHaveBeenCalled();
  });

  it('does not accept long name', async function () {
    MockApiClient.clearMockResponses();
    jest.spyOn(indicators, 'addErrorMessage');

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
      statusCode: 400,
    });

    await userEvent.type(
      screen.getByRole('textbox', {name: /name/i}),
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    await waitFor(() =>
      expect(assignMock).toHaveBeenCalledWith(
        '/api-tokens/1/',
        expect.objectContaining({
          method: 'PUT',
          data: expect.objectContaining({
            name: 'token1Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in',
          }),
        })
      )
    );

    expect(indicators.addErrorMessage).toHaveBeenCalled();
  });
});
