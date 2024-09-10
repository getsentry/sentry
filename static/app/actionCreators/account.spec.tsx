import {waitFor} from 'sentry-test/reactTestingLibrary';

import {logout} from './account';

jest.mock('react-router-dom');

describe('logout', () => {
  it('has can logout', async function () {
    jest.spyOn(window.location, 'assign').mockImplementation(() => {});
    const mockApi = new MockApiClient();
    const mockApiDelete = MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
    });

    logout(mockApi);

    await waitFor(() => expect(mockApiDelete).toHaveBeenCalled());
    expect(window.location.assign).toHaveBeenCalledWith('/auth/login/');
  });
});
