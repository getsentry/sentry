import {BroadcastFixture} from 'sentry-fixture/broadcast';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';
import {PrimaryNavigationWhatsNew} from 'sentry/views/navigation/primary/whatsNew';

jest.mock('sentry/utils/analytics');

describe('WhatsNew', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/broadcasts/',
      method: 'PUT',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/broadcasts/`,
      match: [MockApiClient.matchQuery({show: 'latest', limit: '3'})],
      body: [],
    });
    jest.useRealTimers();
  });

  it('renders empty state when API returns no broadcasts', async () => {
    render(<PrimaryNavigationWhatsNew />);

    await userEvent.click(screen.getByRole('button', {name: "What's New"}));

    expect(await screen.findByText(/No recent updates/)).toBeInTheDocument();
  });

  it('does not show the unread indicator when all broadcasts are seen', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/broadcasts/`,
      match: [MockApiClient.matchQuery({show: 'latest', limit: '3'})],
      body: [
        BroadcastFixture({id: '1', hasSeen: true}),
        BroadcastFixture({id: '2', hasSeen: true}),
        BroadcastFixture({id: '3', hasSeen: true}),
      ],
    });

    render(<PrimaryNavigationWhatsNew />);

    const whatsNewButton = screen.getByRole('button', {name: "What's New"});
    await waitFor(() => {
      expect(
        whatsNewButton.querySelector('[data-unread-indicator]')
      ).not.toBeInTheDocument();
    });
  });

  it('renders broadcasts even when all have been seen', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/broadcasts/`,
      match: [MockApiClient.matchQuery({show: 'latest', limit: '3'})],
      body: [
        BroadcastFixture({id: '1', title: 'Seen Broadcast 1', hasSeen: true}),
        BroadcastFixture({id: '2', title: 'Seen Broadcast 2', hasSeen: true}),
        BroadcastFixture({id: '3', title: 'Seen Broadcast 3', hasSeen: true}),
      ],
    });

    render(<PrimaryNavigationWhatsNew />);

    await userEvent.click(screen.getByRole('button', {name: "What's New"}));

    expect(await screen.findByText('Seen Broadcast 1')).toBeInTheDocument();
    expect(screen.getByText('Seen Broadcast 2')).toBeInTheDocument();
    expect(screen.getByText('Seen Broadcast 3')).toBeInTheDocument();
    expect(screen.queryByText(/No recent updates/)).not.toBeInTheDocument();
  });

  it('displays the unread indicator when there are unseen broadcasts', async () => {
    jest.useFakeTimers();

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/broadcasts/`,
      match: [MockApiClient.matchQuery({show: 'latest', limit: '3'})],
      body: [
        BroadcastFixture({
          id: '1',
          title: 'Test Broadcast 1',
          category: 'blog',
          hasSeen: false,
        }),
        BroadcastFixture({
          id: '2',
          title: 'Test Broadcast 2',
          category: 'blog',
          hasSeen: false,
        }),
        BroadcastFixture({
          id: '3',
          title: 'Test Broadcast 3',
          category: 'blog',
          hasSeen: true,
        }),
      ],
    });

    render(<PrimaryNavigationWhatsNew />);

    await waitFor(() =>
      expect(
        screen
          .getByRole('button', {name: "What's New"})
          .querySelector('[data-unread-indicator]')
      ).toBeInTheDocument()
    );
  });

  it('does not call the mark-seen endpoint when all broadcasts are already seen', async () => {
    jest.useFakeTimers();

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/broadcasts/`,
      match: [MockApiClient.matchQuery({show: 'latest', limit: '3'})],
      body: [
        BroadcastFixture({id: '1', title: 'Seen Broadcast 1', hasSeen: true}),
        BroadcastFixture({id: '2', title: 'Seen Broadcast 2', hasSeen: true}),
        BroadcastFixture({id: '3', title: 'Seen Broadcast 3', hasSeen: true}),
      ],
    });

    const putMock = MockApiClient.addMockResponse({
      url: '/broadcasts/',
      method: 'PUT',
    });

    render(<PrimaryNavigationWhatsNew />);

    await userEvent.click(screen.getByRole('button', {name: "What's New"}), {
      delay: null,
    });

    await screen.findByText('Seen Broadcast 1');

    act(() => jest.advanceTimersByTime(2000));

    await waitFor(() => {
      expect(putMock).not.toHaveBeenCalled();
    });
  });

  it('marks unseen broadcasts as seen after opening the panel', async () => {
    jest.useFakeTimers();

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/broadcasts/`,
      match: [MockApiClient.matchQuery({show: 'latest', limit: '3'})],
      body: [
        BroadcastFixture({
          id: '1',
          title: 'Test Broadcast 1',
          category: 'blog',
          hasSeen: false,
        }),
        BroadcastFixture({
          id: '2',
          title: 'Test Broadcast 2',
          category: 'blog',
          hasSeen: false,
        }),
        BroadcastFixture({
          id: '3',
          title: 'Test Broadcast 3',
          category: 'blog',
          hasSeen: true,
        }),
      ],
    });

    const putMock = MockApiClient.addMockResponse({
      url: '/broadcasts/',
      method: 'PUT',
    });

    render(<PrimaryNavigationWhatsNew />);

    await userEvent.click(screen.getByRole('button', {name: "What's New"}), {
      delay: null,
    });

    await screen.findByText('Test Broadcast 1');

    act(() => jest.advanceTimersByTime(2000));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith(
        '/broadcasts/',
        expect.objectContaining({
          method: 'PUT',
          query: {id: ['1', '2']},
          data: {hasSeen: '1'},
        })
      );
    });
  });

  it('hides the unread indicator after broadcasts are marked as seen', async () => {
    jest.useFakeTimers();

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/broadcasts/`,
      match: [MockApiClient.matchQuery({show: 'latest', limit: '3'})],
      body: [
        BroadcastFixture({
          id: '1',
          title: 'Test Broadcast 1',
          category: 'blog',
          hasSeen: false,
        }),
        BroadcastFixture({
          id: '2',
          title: 'Test Broadcast 2',
          category: 'blog',
          hasSeen: false,
        }),
      ],
    });

    render(<PrimaryNavigationWhatsNew />);

    const whatsNewButton = screen.getByRole('button', {name: "What's New"});
    await waitFor(() =>
      expect(whatsNewButton.querySelector('[data-unread-indicator]')).toBeInTheDocument()
    );

    await userEvent.click(whatsNewButton, {
      delay: null,
    });

    await screen.findByText('Test Broadcast 1');

    act(() => jest.advanceTimersByTime(2000));

    await waitFor(() => {
      expect(
        whatsNewButton.querySelector('[data-unread-indicator]')
      ).not.toBeInTheDocument();
    });
  });

  it('renders a broadcast item with media content correctly', async () => {
    const broadcast = BroadcastFixture({
      mediaUrl:
        'https://images.ctfassets.net/em6l9zw4tzag/2vWdw7ZaApWxygugalbyOC/285525e5b7c9fbfa8fb814a69ab214cd/PerformancePageSketches_hero.jpg?w=2520&h=945&q=50&fm=webp',
      category: 'blog',
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/broadcasts/`,
      match: [MockApiClient.matchQuery({show: 'latest', limit: '3'})],
      body: [broadcast],
    });

    render(<PrimaryNavigationWhatsNew />);

    await userEvent.click(screen.getByRole('button', {name: "What's New"}));

    expect(await screen.findByText('Blog Post')).toBeInTheDocument();
    const titleLink = screen.getByRole('link', {name: broadcast.title});
    expect(titleLink).toHaveAttribute('href', broadcast.link);
    expect(screen.getByText(broadcast.message, {exact: false})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Read more'})).toHaveAttribute(
      'href',
      broadcast.link
    );

    await userEvent.click(titleLink);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'whats_new.link_clicked',
      expect.objectContaining({
        title: broadcast.title,
        category: 'blog',
      })
    );
  });

  it('filters out duplicate titles and only shows the first occurrence', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/broadcasts/`,
      match: [MockApiClient.matchQuery({show: 'latest', limit: '3'})],
      body: [
        BroadcastFixture({id: '1', title: 'Duplicate Title', hasSeen: true}),
        BroadcastFixture({id: '2', title: 'Duplicate Title', hasSeen: true}),
        BroadcastFixture({id: '3', title: 'Unique Title', hasSeen: true}),
      ],
    });

    render(<PrimaryNavigationWhatsNew />);

    await userEvent.click(screen.getByRole('button', {name: "What's New"}));

    expect(await screen.findByText('Duplicate Title')).toBeInTheDocument();
    expect(screen.getAllByText('Duplicate Title')).toHaveLength(1);
    expect(screen.getByText('Unique Title')).toBeInTheDocument();
  });

  it('marks unseen duplicate broadcasts as seen when the panel is opened', async () => {
    jest.useFakeTimers();

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/broadcasts/`,
      match: [MockApiClient.matchQuery({show: 'latest', limit: '3'})],
      body: [
        BroadcastFixture({id: '1', title: 'Duplicate Title', hasSeen: false}),
        BroadcastFixture({id: '2', title: 'Duplicate Title', hasSeen: false}),
        BroadcastFixture({id: '3', title: 'Unique Title', hasSeen: true}),
      ],
    });

    const putMock = MockApiClient.addMockResponse({
      url: '/broadcasts/',
      method: 'PUT',
    });

    render(<PrimaryNavigationWhatsNew />);

    await userEvent.click(screen.getByRole('button', {name: "What's New"}), {
      delay: null,
    });

    await screen.findByText('Duplicate Title');

    act(() => jest.advanceTimersByTime(2000));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith(
        '/broadcasts/',
        expect.objectContaining({
          method: 'PUT',
          query: {id: ['1', '2']},
          data: {hasSeen: '1'},
        })
      );
    });
  });

  it('renders broadcast items for each category type', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/broadcasts/`,
      match: [MockApiClient.matchQuery({show: 'latest', limit: '3'})],
      body: [
        BroadcastFixture({id: '1', title: 'Broadcast 1', category: 'announcement'}),
        BroadcastFixture({id: '2', title: 'Broadcast 2', category: 'feature'}),
        BroadcastFixture({id: '3', title: 'Broadcast 3', category: 'blog'}),
        BroadcastFixture({id: '4', title: 'Broadcast 4', category: 'event'}),
        BroadcastFixture({id: '5', title: 'Broadcast 5', category: 'video'}),
      ],
    });

    render(<PrimaryNavigationWhatsNew />);

    await userEvent.click(screen.getByRole('button', {name: "What's New"}));

    expect(await screen.findByText('Announcement')).toBeInTheDocument();
    expect(screen.getByText('New Feature')).toBeInTheDocument();
    expect(screen.getByText('Blog Post')).toBeInTheDocument();
    expect(screen.getByText('Event')).toBeInTheDocument();
    expect(screen.getByText('Video')).toBeInTheDocument();
  });
});
