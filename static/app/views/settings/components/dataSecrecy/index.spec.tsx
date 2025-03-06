import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import DataSecrecy from 'sentry/views/settings/components/dataSecrecy';

jest.mock('sentry/actionCreators/indicator');

describe('DataSecrecy', function () {
  const {organization} = initializeOrg({
    organization: {features: ['data-secrecy']},
  });

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders default state with no waiver', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-secrecy/`,
      body: null,
    });

    render(<DataSecrecy />, {organization});

    await waitFor(() => {
      expect(screen.getByText('Support Access')).toBeInTheDocument();
    });

    organization.allowSuperuserAccess = false;

    await waitFor(() => {
      expect(
        screen.getByText(/sentry employees do not have access to your organization/i)
      ).toBeInTheDocument();
    });
  });

  it('renders default state with waiver', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-secrecy/`,
      body: null,
    });

    render(<DataSecrecy />, {organization});

    await waitFor(() => {
      expect(screen.getByText('Support Access')).toBeInTheDocument();
    });

    organization.allowSuperuserAccess = true;

    await waitFor(() => {
      expect(
        screen.getByText(/sentry employees do not have access to your organization/i)
      ).toBeInTheDocument();
    });
  });

  it('renders no access state with waiver present', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-secrecy/`,
      body: {
        accessStart: '2022-08-29T01:05:00+00:00',
        accessEnd: '2023-08-29T01:05:00+00:00',
      },
    });

    render(<DataSecrecy />, {organization});

    await waitFor(() => {
      expect(screen.getByText('Support Access')).toBeInTheDocument();
    });

    organization.allowSuperuserAccess = false;

    // we should see no access message
    await waitFor(() => {
      expect(
        screen.getByText(
          /sentry employees will not have access to your organization unless granted permission/i
        )
      ).toBeInTheDocument();
    });
  });

  it('renders current waiver state', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-secrecy/`,
      body: {
        accessStart: '2023-08-29T01:05:00+00:00',
        accessEnd: '2024-08-29T01:05:00+00:00',
      },
    });

    organization.allowSuperuserAccess = false;
    render(<DataSecrecy />, {organization});

    await waitFor(() => {
      const accessMessage = screen.getByText(
        /Sentry employees has access to your organization until/i
      );
      expect(accessMessage).toBeInTheDocument();
    });
  });

  it('can update permanent access', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-secrecy/`,
      body: {
        accessStart: '2023-08-29T01:05:00+00:00',
        accessEnd: '2024-08-29T01:05:00+00:00',
      },
    });

    const mockUpdate = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
    });

    organization.allowSuperuserAccess = false;
    render(<DataSecrecy />, {organization});

    // Toggle permanent access on
    const allowAccessToggle = screen.getByRole('checkbox', {
      name: /Sentry employees will not have access to your data unless granted permission/,
    });
    allowAccessToggle.click();

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/`,
        expect.objectContaining({
          method: 'PUT',
          data: {allowSuperuserAccess: true},
        })
      );
    });
  });
});
