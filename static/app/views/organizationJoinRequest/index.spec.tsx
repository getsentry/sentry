import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import OrganizationJoinRequest from 'sentry/views/organizationJoinRequest';

jest.mock('sentry/utils/analytics', () => ({
  trackAdhocEvent: jest.fn(),
}));

jest.mock('sentry/actionCreators/indicator');

describe('OrganizationJoinRequest', () => {
  const org = OrganizationFixture({slug: 'test-org'});
  const endpoint = `/organizations/${org.slug}/join-request/`;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders', () => {
    render(<OrganizationJoinRequest />, {
      initialRouterConfig: {
        location: {
          pathname: `/join-request/${org.slug}/`,
        },
        route: '/join-request/:orgId/',
      },
    });

    expect(screen.getByRole('heading', {name: 'Request to Join'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Email Address'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Request to Join'})).toBeInTheDocument();
  });

  it('submits', async () => {
    const postMock = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
    });

    render(<OrganizationJoinRequest />, {
      initialRouterConfig: {
        location: {
          pathname: `/join-request/${org.slug}/`,
        },
        route: '/join-request/:orgId/',
      },
    });

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Email Address'}),
      'email@example.com{enter}'
    );

    expect(postMock).toHaveBeenCalled();

    expect(
      await screen.findByRole('heading', {name: 'Request Sent'})
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {name: 'Request to Join'})
    ).not.toBeInTheDocument();
  });

  it('errors', async () => {
    const postMock = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      statusCode: 400,
    });

    render(<OrganizationJoinRequest />, {
      initialRouterConfig: {
        location: {
          pathname: `/join-request/${org.slug}/`,
        },
        route: '/join-request/:orgId/',
      },
    });

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Email Address'}),
      'email@example.com{enter}'
    );

    await waitFor(() => {
      expect(postMock).toHaveBeenCalled();
    });
    expect(addErrorMessage).toHaveBeenCalled();

    expect(screen.getByRole('heading', {name: 'Request to Join'})).toBeInTheDocument();
  });

  it('cancels', async () => {
    render(<OrganizationJoinRequest />, {
      initialRouterConfig: {
        location: {
          pathname: `/join-request/${org.slug}/`,
        },
        route: '/join-request/:orgId/',
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(testableWindowLocation.assign).toHaveBeenCalledWith(
      `/auth/login/${org.slug}/`
    );
  });
});
