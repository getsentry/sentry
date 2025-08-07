import {ApiApplicationFixture} from 'sentry-fixture/apiApplication';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {isDemoModeActive} from 'sentry/utils/demoMode';
import ApiApplications from 'sentry/views/settings/account/apiApplications';

jest.mock('sentry/utils/demoMode');

describe('ApiApplications', function () {
  const {routerProps, router} = initializeOrg({router: {params: {}}});

  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders empty', async function () {
    MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: [],
    });

    render(<ApiApplications {...routerProps} />);
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(
      screen.getByText("You haven't created any applications yet.")
    ).toBeInTheDocument();
  });

  it('renders', async function () {
    const requestMock = MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: [ApiApplicationFixture()],
    });

    render(<ApiApplications {...routerProps} />);
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(requestMock).toHaveBeenCalled();

    expect(screen.getByText('Adjusted Shrimp')).toBeInTheDocument();
  });

  it('renders empty in demo mode even if there are applications', async function () {
    (isDemoModeActive as jest.Mock).mockReturnValue(true);

    MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: [ApiApplicationFixture()],
    });

    render(<ApiApplications {...routerProps} />);

    expect(
      await screen.findByText("You haven't created any applications yet.")
    ).toBeInTheDocument();

    (isDemoModeActive as jest.Mock).mockReset();
  });

  it('creates application', async function () {
    MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: [],
    });
    const createApplicationRequest = MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: ApiApplicationFixture({
        id: '234',
      }),
      method: 'POST',
    });

    render(<ApiApplications {...routerProps} />);
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

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
    const apiApp = ApiApplicationFixture({id: '123'});
    MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: [apiApp],
    });
    const deleteApplicationRequest = MockApiClient.addMockResponse({
      url: '/api-applications/123/',
      method: 'DELETE',
    });

    render(<ApiApplications {...routerProps} />);
    renderGlobalModal();
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    await userEvent.click(screen.getByLabelText('Remove'));

    await userEvent.type(
      await screen.findByRole('textbox', {name: /confirm the deletion/}),
      apiApp.name
    );
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

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
