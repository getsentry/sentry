import {ApiApplicationFixture} from 'sentry-fixture/apiApplication';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {isDemoModeEnabled} from 'sentry/utils/demoMode';
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
    (isDemoModeEnabled as jest.Mock).mockReturnValue(true);

    MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: [ApiApplicationFixture()],
    });

    render(<ApiApplications {...routerProps} />);

    expect(
      await screen.findByText("You haven't created any applications yet.")
    ).toBeInTheDocument();

    (isDemoModeEnabled as jest.Mock).mockReset();
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
    MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: [ApiApplicationFixture({id: '123'})],
    });
    const deleteApplicationRequest = MockApiClient.addMockResponse({
      url: '/api-applications/123/',
      method: 'DELETE',
    });

    render(<ApiApplications {...routerProps} />);
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

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
