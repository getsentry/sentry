import {ApiApplication} from 'sentry-fixture/apiApplication';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ApiApplications from 'sentry/views/settings/account/apiApplications';

describe('ApiApplications', function () {
  const {routerProps, router} = initializeOrg({router: {params: {}}});

  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders empty', function () {
    MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: [],
    });

    render(<ApiApplications {...routerProps} />);

    expect(
      screen.getByText("You haven't created any applications yet.")
    ).toBeInTheDocument();
  });

  it('renders', function () {
    const requestMock = MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: [ApiApplication()],
    });

    render(<ApiApplications {...routerProps} />);

    expect(requestMock).toHaveBeenCalled();

    expect(screen.getByText('Adjusted Shrimp')).toBeInTheDocument();
  });

  it('creates application', async function () {
    MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: [],
    });
    const createApplicationRequest = MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: ApiApplication({
        id: '234',
      }),
      method: 'POST',
    });

    render(<ApiApplications {...routerProps} />);

    await userEvent.click(screen.getByLabelText('Create New Application'));

    expect(createApplicationRequest).toHaveBeenCalledWith(
      '/api-applications/',
      expect.objectContaining({method: 'POST'})
    );

    await waitFor(() => {
      expect(router.push).toHaveBeenLastCalledWith(
        '/settings/account/api/applications/234/'
      );
    });
  });

  it('deletes application', async function () {
    MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: [ApiApplication({id: '123'})],
    });
    const deleteApplicationRequest = MockApiClient.addMockResponse({
      url: '/api-applications/123/',
      method: 'DELETE',
    });

    render(<ApiApplications {...routerProps} />);

    await userEvent.click(screen.getByLabelText('Remove'));

    expect(deleteApplicationRequest).toHaveBeenCalledWith(
      '/api-applications/123/',
      expect.objectContaining({method: 'DELETE'})
    );

    await waitFor(() => {
      expect(
        screen.getByText("You haven't created any applications yet.")
      ).toBeInTheDocument();
    });
  });
});
