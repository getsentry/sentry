import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ApiApplications from 'sentry/views/settings/account/apiApplications';

describe('ApiApplications', function () {
  it('renders empty', async function () {
    const {router} = initializeOrg();

    MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: [],
    });

    render(
      <ApiApplications
        router={router}
        params={{}}
        location={router.location}
        routes={router.routes}
        route={{}}
        routeParams={{}}
      />
    );

    expect(
      screen.getByText("You haven't created any applications yet.")
    ).toBeInTheDocument();
  });

  it('renders', async function () {
    const {router} = initializeOrg();

    const requestMock = MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: [TestStubs.ApiApplication()],
    });

    render(
      <ApiApplications
        router={router}
        params={{}}
        location={router.location}
        routes={router.routes}
        route={{}}
        routeParams={{}}
      />
    );

    expect(requestMock).toHaveBeenCalled();

    expect(screen.getByText('Adjusted Shrimp')).toBeInTheDocument();
  });

  it('creates application', async function () {
    const {router} = initializeOrg();

    const createApplicationRequest = MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: TestStubs.ApiApplication({
        id: '234',
      }),
      method: 'POST',
    });

    render(
      <ApiApplications
        router={router}
        params={{}}
        location={router.location}
        routes={router.routes}
        route={{}}
        routeParams={{}}
      />
    );

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
    const deleteApplicationRequest = MockApiClient.addMockResponse({
      url: '/api-applications/123/',
      method: 'DELETE',
    });

    const {router} = initializeOrg();

    render(
      <ApiApplications
        router={router}
        params={{}}
        location={router.location}
        routes={router.routes}
        route={{}}
        routeParams={{}}
      />
    );

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
