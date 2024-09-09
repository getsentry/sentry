import {redirect} from 'react-router-dom';

import {waitFor} from 'sentry-test/reactTestingLibrary';

import {logout} from './account';

jest.mock('react-router-dom');

describe('logout', () => {
  it('has can logout', async function () {
    const mock = MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
    });

    const api = new MockApiClient();
    logout(api);

    await waitFor(() => expect(mock).toHaveBeenCalled());
    await waitFor(() => expect(redirect).toHaveBeenCalled());
  });
});
