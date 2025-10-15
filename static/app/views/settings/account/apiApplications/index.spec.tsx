import {ApiApplicationFixture} from 'sentry-fixture/apiApplication';

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

describe('ApiApplications', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders empty', async () => {
    MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: [],
    });

    render(<ApiApplications />);
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(
      screen.getByText("You haven't created any applications yet.")
    ).toBeInTheDocument();
  });

  it('renders', async () => {
    const requestMock = MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: [ApiApplicationFixture()],
    });

    render(<ApiApplications />);
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(requestMock).toHaveBeenCalled();

    expect(screen.getByText('Adjusted Shrimp')).toBeInTheDocument();
  });

  it('renders empty in demo mode even if there are applications', async () => {
    (isDemoModeActive as jest.Mock).mockReturnValue(true);

    MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: [ApiApplicationFixture()],
    });

    render(<ApiApplications />);

    expect(
      await screen.findByText("You haven't created any applications yet.")
    ).toBeInTheDocument();

    (isDemoModeActive as jest.Mock).mockReset();
  });

  it('creates application', async () => {
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

    const {router} = render(<ApiApplications />);
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    await userEvent.click(screen.getByLabelText('Create New Application'));

    expect(createApplicationRequest).toHaveBeenCalledWith(
      '/api-applications/',
      expect.objectContaining({method: 'POST'})
    );

    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: '/settings/account/api/applications/234/',
          query: {},
        })
      );
    });
  });

  it('deletes application', async () => {
    const apiApp = ApiApplicationFixture({id: '123'});
    MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: [apiApp],
    });
    const deleteApplicationRequest = MockApiClient.addMockResponse({
      url: '/api-applications/123/',
      method: 'DELETE',
    });

    render(<ApiApplications />);
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
