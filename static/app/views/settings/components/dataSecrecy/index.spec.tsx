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

    render(<DataSecrecy />, {organization: organization});

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

  it('renders current waiver state', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-secrecy/`,
      body: {
        access_start: '2023-08-29T01:05:00+00:00',
        access_end: '2024-08-29T01:05:00+00:00',
      },
    });

    organization.allowSuperuserAccess = false;
    render(<DataSecrecy />, {organization: organization});

    await waitFor(() => {
      const accessMessage = screen.getByText(
        /Sentry employees has access to your organization until/i
      );
      expect(accessMessage).toBeInTheDocument();
    });
  });
});
