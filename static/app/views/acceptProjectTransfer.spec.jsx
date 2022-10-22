import {Organization} from 'fixtures/js-stubs/organization';
import {Project} from 'fixtures/js-stubs/project';
import {Team} from 'fixtures/js-stubs/team';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import AcceptProjectTransfer from 'sentry/views/acceptProjectTransfer';

describe('AcceptProjectTransfer', function () {
  let getMock;
  let postMock;
  const endpoint = '/accept-transfer/';
  beforeEach(function () {
    MockApiClient.clearMockResponses();

    getMock = MockApiClient.addMockResponse({
      url: '/accept-transfer/',
      method: 'GET',
      body: {
        project: Project(),
        organizations: [Organization({teams: [Team()]})],
      },
    });

    postMock = MockApiClient.addMockResponse({
      url: '/accept-transfer/',
      method: 'POST',
      statusCode: 204,
    });
  });

  it('renders', function () {
    render(
      <AcceptProjectTransfer
        location={{
          pathname: 'endpoint',
          query: {data: 'XYZ'},
        }}
      />
    );

    expect(getMock).toHaveBeenCalled();
  });

  it('submits', function () {
    render(
      <AcceptProjectTransfer
        location={{
          pathname: 'endpoint',
          query: {data: 'XYZ'},
        }}
      />
    );

    userEvent.click(screen.getByRole('button', {name: 'Transfer Project'}));

    expect(postMock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: 'POST',
      })
    );
  });
});
