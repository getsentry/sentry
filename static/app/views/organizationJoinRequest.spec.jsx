import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {trackAdhocEvent} from 'sentry/utils/analytics';
import OrganizationJoinRequest from 'sentry/views/organizationJoinRequest';

jest.mock('sentry/utils/analytics', () => ({
  trackAdhocEvent: jest.fn(),
}));
jest.mock('sentry/actionCreators/indicator');

describe('OrganizationJoinRequest', function () {
  const org = TestStubs.Organization({slug: 'test-org'});
  const endpoint = `/organizations/${org.slug}/join-request/`;

  beforeEach(function () {
    trackAdhocEvent.mockClear();
    MockApiClient.clearMockResponses();
  });

  it('renders', function () {
    render(<OrganizationJoinRequest params={{orgId: org.slug}} />);

    expect(screen.getByRole('heading', {name: 'Request to Join'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Email Address'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Request to Join'})).toBeInTheDocument();

    expect(trackAdhocEvent).toHaveBeenCalledWith({
      eventKey: 'join_request.viewed',
      org_slug: org.slug,
    });
  });

  it('submits', async function () {
    const postMock = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
    });

    render(<OrganizationJoinRequest params={{orgId: org.slug}} />);

    userEvent.type(
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

  it('errors', async function () {
    const postMock = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      statusCode: 400,
    });

    render(<OrganizationJoinRequest params={{orgId: org.slug}} />);

    userEvent.type(
      screen.getByRole('textbox', {name: 'Email Address'}),
      'email@example.com{enter}'
    );

    await waitFor(() => {
      expect(postMock).toHaveBeenCalled();
      expect(addErrorMessage).toHaveBeenCalled();
    });

    expect(screen.getByRole('heading', {name: 'Request to Join'})).toBeInTheDocument();
  });

  it('cancels', function () {
    const spy = jest.spyOn(window.location, 'assign').mockImplementation(() => {});
    render(<OrganizationJoinRequest params={{orgId: org.slug}} />);

    userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(spy).toHaveBeenCalledWith(`/auth/login/${org.slug}/`);
  });
});
