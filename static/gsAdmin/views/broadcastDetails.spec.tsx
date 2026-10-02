import {ConfigFixture} from 'sentry-fixture/config';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ConfigStore} from 'sentry/stores/configStore';

import {BroadcastDetails} from 'admin/views/broadcastDetails';

describe('Broadcast Details', () => {
  it('renders', async () => {
    const broadcast = {
      id: '1359',
      message:
        "Tracing is the process of tracking the flow of execution within an application, especially in distributed systems or microservices. Sentry's tracing tool can help you debug in many ways.",
      title: 'Everyone can trace',
      link: 'https://blog.sentry.io/everyone-needs-to-know-how-to-trace/',
      mediaUrl:
        'https://images.ctfassets.net/em6l9zw4tzag/4Y9ryblNX2VZZhkZoI7JPe/ec5d5ea1c8bb55bd6898c7b038319947/0823_DTSD163_flyIO-hero.jpg?w=2520&h=945&q=50&fm=webp',
      isActive: false,
      dateCreated: '2024-09-06T13:25:01.384278Z',
      dateExpires: '2024-09-13T15:24:00Z',
      hasSeen: false,
      category: 'blog',
      userCount: 0,
      plans: [],
      roles: [],
      trialStatus: [],
      region: 'de',
      platform: ['bun', 'capacitor'],
      product: ['errors', 'spans'],
      createdBy: 'admin@sentry.io',
      organizations: [123, 456],
      earlyAdopter: true,
    };

    MockApiClient.addMockResponse({
      url: `/broadcasts/${broadcast.id}/`,
      body: broadcast,
    });

    render(<BroadcastDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/_admin/broadcasts/${broadcast.id}/`,
        },
        route: '/_admin/broadcasts/:broadcastId/',
      },
    });

    expect(await screen.findByRole('heading', {name: 'Broadcasts'})).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(`Media URL:${broadcast.mediaUrl}`))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher('Category:Blog Post'))
    ).toBeInTheDocument();
    expect(screen.getByText(textWithMarkupMatcher('Region:DE'))).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher('Platform:Bun, Capacitor'))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher('Product:Errors, Spans'))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher('Created By:admin@sentry.io'))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher('Organization IDs:123, 456'))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher('Early Adopter:Yes'))
    ).toBeInTheDocument();
  });

  it('updates a broadcast through the Scraps form', async () => {
    ConfigStore.loadInitialData(
      ConfigFixture({
        user: UserFixture({permissions: new Set(['broadcasts.admin'])}),
      })
    );
    MockApiClient.addMockResponse({
      url: '/broadcasts/1359/',
      body: {
        id: '1359',
        title: 'Original title',
        message: 'Original message',
        link: 'https://example.com',
        isActive: true,
        mediaUrl: 'https://example.com/image.png',
        category: 'blog',
        plans: [],
        roles: [],
        platform: [],
        product: [],
        dateExpires: null,
      },
    });
    const update = MockApiClient.addMockResponse({
      url: '/broadcasts/1359/',
      method: 'PUT',
      body: {id: '1359'},
    });
    render(<BroadcastDetails />, {
      initialRouterConfig: {
        location: {pathname: '/_admin/broadcasts/1359/'},
        route: '/_admin/broadcasts/:broadcastId/',
      },
    });

    await userEvent.click(
      await screen.findByRole('button', {name: 'Broadcasts Actions'})
    );
    await userEvent.click(screen.getByText('Edit Broadcast'));
    await userEvent.clear(screen.getByRole('textbox', {name: 'Title'}));
    await userEvent.type(screen.getByRole('textbox', {name: 'Title'}), 'Updated title');
    await userEvent.clear(screen.getByRole('textbox', {name: 'Media URL'}));
    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith(
      '/broadcasts/1359/',
      expect.objectContaining({
        data: {
          title: 'Updated title',
          message: 'Original message',
          link: 'https://example.com',
          mediaUrl: null,
          category: 'blog',
          dateExpires: null,
          isActive: true,
        },
      })
    );
  });
  it('omits unchanged empty optional fields when saving', async () => {
    ConfigStore.loadInitialData(
      ConfigFixture({
        user: UserFixture({permissions: new Set(['broadcasts.admin'])}),
      })
    );
    MockApiClient.addMockResponse({
      url: '/broadcasts/1359/',
      body: {
        id: '1359',
        title: 'Original title',
        message: 'Original message',
        link: 'https://example.com',
        isActive: true,
        mediaUrl: null,
        category: null,
        dateExpires: null,
      },
    });
    const update = MockApiClient.addMockResponse({
      url: '/broadcasts/1359/',
      method: 'PUT',
      body: {id: '1359'},
    });
    render(<BroadcastDetails />, {
      initialRouterConfig: {
        location: {pathname: '/_admin/broadcasts/1359/'},
        route: '/_admin/broadcasts/:broadcastId/',
      },
    });

    await userEvent.click(
      await screen.findByRole('button', {name: 'Broadcasts Actions'})
    );
    await userEvent.click(screen.getByText('Edit Broadcast'));
    await userEvent.clear(screen.getByRole('textbox', {name: 'Title'}));
    await userEvent.type(screen.getByRole('textbox', {name: 'Title'}), 'Updated title');
    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith(
      '/broadcasts/1359/',
      expect.objectContaining({
        data: {
          title: 'Updated title',
          message: 'Original message',
          link: 'https://example.com',
          dateExpires: null,
          isActive: true,
        },
      })
    );
  });
});
