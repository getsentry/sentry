import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {SelectableContainer} from 'admin/components/selectableContainer';
import {UserEmailLog} from 'admin/components/users/userEmailLog';

const user = UserFixture({
  email: 'primary@example.com',
  emails: [
    {id: '1', email: 'primary@example.com', is_verified: true},
    {id: '2', email: 'secondary@example.com', is_verified: true},
  ],
});
const activityUrl = `/_admin/users/${user.id}/email-activity/`;
const bouncesUrl = `/_admin/users/${user.id}/email-bounces/`;

function renderEmailLog() {
  return render(
    <SelectableContainer
      sections={[
        {
          key: 'email',
          name: 'Email log',
          content: ({Panel}) => <UserEmailLog user={user} Panel={Panel} />,
        },
      ]}
    />
  );
}

function mockActivity(event = 'delivered') {
  return MockApiClient.addMockResponse({
    url: activityUrl,
    body: {activity: [{event, email: user.email, created: 1700000000}]},
  });
}

describe('UserEmailLog', () => {
  beforeEach(() => MockApiClient.clearMockResponses());

  it('loads activity for the selected email', async () => {
    const request = mockActivity();
    renderEmailLog();

    expect(await screen.findByText('delivered')).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(
      activityUrl,
      expect.objectContaining({query: {email: user.email}})
    );

    await userEvent.click(screen.getByRole('button', {name: /Results for/}));
    await userEvent.click(screen.getByRole('option', {name: 'secondary@example.com'}));

    await waitFor(() =>
      expect(request).toHaveBeenLastCalledWith(
        activityUrl,
        expect.objectContaining({query: {email: 'secondary@example.com'}})
      )
    );
  });

  it('shows an empty activity log', async () => {
    MockApiClient.addMockResponse({url: activityUrl, body: {activity: []}});
    renderEmailLog();
    expect(await screen.findByText('No results found')).toBeInTheDocument();
  });

  it('shows activity loading errors', async () => {
    MockApiClient.addMockResponse({url: activityUrl, statusCode: 502});
    renderEmailLog();
    expect(
      await screen.findByText('There was a problem loading SendGrid details')
    ).toBeInTheDocument();
  });

  it('removes a bounce through the staff API', async () => {
    mockActivity('bounce');
    const remove = MockApiClient.addMockResponse({
      url: bouncesUrl,
      method: 'DELETE',
      statusCode: 204,
    });
    renderEmailLog();

    await userEvent.click(await screen.findByRole('button', {name: 'remove bounce'}));
    await waitFor(() =>
      expect(remove).toHaveBeenCalledWith(
        bouncesUrl,
        expect.objectContaining({query: {email: user.email}})
      )
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', {name: 'remove bounce'})
      ).not.toBeInTheDocument()
    );
  });

  it('allows retrying a failed bounce removal', async () => {
    mockActivity('bounce');
    const remove = MockApiClient.addMockResponse({
      url: bouncesUrl,
      method: 'DELETE',
      statusCode: 502,
    });
    renderEmailLog();

    await userEvent.click(await screen.findByRole('button', {name: 'remove bounce'}));
    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'remove bounce'})).toBeEnabled()
    );
    await userEvent.click(screen.getByRole('button', {name: 'remove bounce'}));
    await waitFor(() => expect(remove).toHaveBeenCalledTimes(2));
  });
});
