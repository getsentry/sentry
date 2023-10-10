import {Organization} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import AcceptProjectTransfer from 'sentry/views/acceptProjectTransfer';

describe('AcceptProjectTransfer', function () {
  const {routerProps} = initializeOrg();

  let getMock: jest.Mock;
  let postMock: jest.Mock;
  const endpoint = '/accept-transfer/';

  beforeEach(function () {
    MockApiClient.clearMockResponses();

    getMock = MockApiClient.addMockResponse({
      url: '/accept-transfer/',
      method: 'GET',
      body: {
        project: TestStubs.Project(),
        organizations: [Organization({teams: [TestStubs.Team()]})],
      },
    });

    postMock = MockApiClient.addMockResponse({
      url: '/accept-transfer/',
      method: 'POST',
      statusCode: 204,
    });
  });

  it('renders', function () {
    render(<AcceptProjectTransfer {...routerProps} />);

    expect(getMock).toHaveBeenCalled();
  });

  it('submits', async function () {
    render(<AcceptProjectTransfer {...routerProps} />);

    await userEvent.click(screen.getByRole('button', {name: 'Transfer Project'}));

    expect(postMock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: 'POST',
      })
    );
  });
});
