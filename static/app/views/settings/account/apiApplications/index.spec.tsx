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

  it('creates confidential application via modal', async () => {
    MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: [],
    });
    const createApplicationRequest = MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: ApiApplicationFixture({
        id: '234',
        isPublic: false,
      }),
      method: 'POST',
    });

    const {router} = render(<ApiApplications />);
    renderGlobalModal();
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    await userEvent.click(screen.getByLabelText('Create New Application'));

    // Modal should appear with client type selection
    expect(
      await screen.findByRole('heading', {name: 'Create New Application'})
    ).toBeInTheDocument();
    expect(screen.getByText('Confidential')).toBeInTheDocument();
    expect(screen.getByText('Public')).toBeInTheDocument();

    // Click confidential option and create (it's already selected by default)
    await userEvent.click(screen.getByText('Confidential'));
    await userEvent.click(screen.getByRole('button', {name: 'Create Application'}));

    expect(createApplicationRequest).toHaveBeenCalledWith(
      '/api-applications/',
      expect.objectContaining({
        method: 'POST',
        data: {isPublic: false},
      })
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

  it('creates public application via modal', async () => {
    MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: [],
    });
    const createApplicationRequest = MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: ApiApplicationFixture({
        id: '345',
        isPublic: true,
      }),
      method: 'POST',
    });

    const {router} = render(<ApiApplications />);
    renderGlobalModal();
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    await userEvent.click(screen.getByLabelText('Create New Application'));

    // Modal should appear with client type selection
    expect(
      await screen.findByRole('heading', {name: 'Create New Application'})
    ).toBeInTheDocument();

    // Click public option and create
    await userEvent.click(screen.getByText('Public'));
    await userEvent.click(screen.getByRole('button', {name: 'Create Application'}));

    expect(createApplicationRequest).toHaveBeenCalledWith(
      '/api-applications/',
      expect.objectContaining({
        method: 'POST',
        data: {isPublic: true},
      })
    );

    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: '/settings/account/api/applications/345/',
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
