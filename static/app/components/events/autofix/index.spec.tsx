import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Autofix} from 'sentry/components/events/autofix';

const group = GroupFixture();
const event = EventFixture();

describe('Autofix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/autofix/setup/`,
      body: {
        genAIConsent: {ok: true},
        integration: {ok: true},
        githubWriteIntegration: {
          ok: true,
          repos: [
            {
              provider: 'integrations:github',
              owner: 'getsentry',
              name: 'sentry',
              external_id: '123',
            },
          ],
        },
      },
    });
  });

  it('renders the Banner component', () => {
    render(<Autofix event={event} group={group} />);

    expect(screen.getByText('Try Autofix')).toBeInTheDocument();
  });

  it('shows the setup button when setup is not complete', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/autofix/setup/`,
      body: {
        genAIConsent: {ok: true},
        integration: {ok: false},
        githubWriteIntegration: {ok: true},
      },
    });
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/autofix/`,
      body: null,
    });

    render(<Autofix event={event} group={group} />);

    expect(
      await screen.findByRole('button', {name: 'Set up Autofix'})
    ).toBeInTheDocument();
  });

  it('allows autofix to be started without github app installation', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/autofix/setup/`,
      body: {
        genAIConsent: {ok: true},
        integration: {ok: true},
        githubWriteIntegration: {ok: false},
      },
    });
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/autofix/`,
      body: null,
    });

    render(<Autofix event={event} group={group} />);

    expect(await screen.findByRole('button', {name: 'Open Autofix'})).toBeInTheDocument();
  });
});
