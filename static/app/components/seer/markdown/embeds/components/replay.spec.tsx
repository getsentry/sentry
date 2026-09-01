import {screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {renderEmbed} from './resourceEmbedTestUtils';

describe('replay embed', () => {
  it('links a replay to the relevant event timestamp (inline)', async () => {
    const {router} = renderEmbed({
      name: 'replay',
      data: {
        id: '4c1f2e3d1234567890',
        eventTimestamp: '2026-08-25T16:37:12Z',
      },
      level: 'inline',
    });

    await userEvent.click(screen.getByRole('link', {name: 'Replay 4c1f2e3d'}));

    expect(router.location.pathname).toBe(
      '/organizations/org-slug/explore/replays/4c1f2e3d1234567890/'
    );
    expect(router.location.query.event_t).toBe('2026-08-25T16:37:12Z');
  });

  it('links a replay without a timestamp to the beginning (inline)', () => {
    renderEmbed({
      name: 'replay',
      data: {id: 'abcdef1234567890'},
      level: 'inline',
    });

    expect(screen.getByRole('link', {name: 'Replay abcdef12'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/replays/abcdef1234567890/'
    );
  });

  it('renders a replay player preview at block level with a timestamp', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    renderEmbed({
      name: 'replay',
      data: {
        id: '4c1f2e3d1234567890',
        eventTimestamp: '2026-08-25T16:37:12Z',
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('replay-loading-placeholder')).toBeInTheDocument();
    });
  });

  it('falls back to a link at block level without a timestamp', () => {
    renderEmbed({
      name: 'replay',
      data: {id: 'abcdef1234567890'},
    });

    expect(screen.getByRole('link', {name: 'Replay abcdef12'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/replays/abcdef1234567890/'
    );
  });
});
