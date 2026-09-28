import {ConfigFixture} from 'sentry-fixture/config';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';

import {SeerDrawerHeader} from './header';

describe('SeerDrawerHeader', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    ConfigStore.loadInitialData(
      ConfigFixture({
        user: UserFixture({
          emails: [{email: 'user@example.com', id: '1', is_verified: true}],
        }),
      })
    );
  });

  it('links Sentry employees to the Autofix conversation from the debug menu', async () => {
    ConfigStore.loadInitialData(
      ConfigFixture({
        user: UserFixture({
          emails: [{email: 'employee@sentry.io', id: '1', is_verified: true}],
        }),
      })
    );

    render(
      <SeerDrawerHeader
        autofixState={{
          run_id: 1,
          status: 'completed',
          updated_at: '2026-01-01T12:00:00Z',
          blocks: [
            {
              id: 'block-1',
              message: {content: 'Found root cause', role: 'assistant'},
              timestamp: '2026-01-01T12:00:00Z',
            },
          ],
        }}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Debug'}));

    const conversationLink = screen.getByRole('menuitemradio', {
      name: 'Open agent trace',
    });
    const url = new URL(conversationLink.getAttribute('href')!, 'https://sentry.io');
    expect(url.pathname).toBe(
      `/organizations/${organization.slug}/explore/agents/conversations/1/`
    );
    expect(url.searchParams.get('project')).toBe('6178942');
    expect(url.searchParams.get('referrer')).toBe('issue-details-autofix-debug');
    expect(conversationLink).toHaveAttribute('target', '_blank');
    expect(conversationLink).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('hides the debug link for non-employees', () => {
    render(
      <SeerDrawerHeader
        autofixState={{
          run_id: 1,
          status: 'completed',
          updated_at: '2026-01-01T12:00:00Z',
          blocks: [],
        }}
      />,
      {organization}
    );

    expect(screen.queryByRole('button', {name: 'Debug'})).not.toBeInTheDocument();
  });
});
