import {waitFor} from 'sentry-test/reactTestingLibrary';

import {testableWindowLocation} from 'sentry/utils/testableLocation';

import {logout} from './account';

describe('logout', () => {
  it('has can logout', async function () {
    const mockApi = new MockApiClient();
    const mockApiDelete = MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
    });

    logout(mockApi);

    await waitFor(() => expect(mockApiDelete).toHaveBeenCalled());
    expect(testableWindowLocation.assign).toHaveBeenCalledWith('/auth/login/');
  });
});
