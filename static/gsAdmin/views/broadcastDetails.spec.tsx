import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import BroadcastDetails from 'admin/views/broadcastDetails';

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
      screen.getByText(textWithMarkupMatcher(`Category:Blog Post`))
    ).toBeInTheDocument();
    expect(screen.getByText(textWithMarkupMatcher(`Region:DE`))).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(`Platform:Bun, Capacitor`))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(`Product:Errors, Spans`))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(`Created By:admin@sentry.io`))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(`Early Adopter:Yes`))
    ).toBeInTheDocument();
  });
});
