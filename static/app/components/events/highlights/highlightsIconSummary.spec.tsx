import {EventFixture} from 'sentry-fixture/event';
import {EventAttachmentFixture} from 'sentry-fixture/eventAttachment';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {HighlightsIconSummary} from 'sentry/components/events/highlights/highlightsIconSummary';

import {TEST_EVENT_CONTEXTS, TEST_EVENT_TAGS} from './testUtils';

jest.mock('sentry/components/events/contexts/contextIcon', () => ({
  ...jest.requireActual('sentry/components/events/contexts/contextIcon'),
  getLogoImage: () => 'data:image/test',
}));

describe('HighlightsIconSummary', () => {
  const organization = OrganizationFixture();
  const group = GroupFixture();
  const event = EventFixture({
    contexts: TEST_EVENT_CONTEXTS,
    tags: TEST_EVENT_TAGS,
  });
  const iosDeviceContext = {
    type: 'device',
    name: 'device',
    version: 'device version',
    model: 'iPhone14,5',
    arch: 'x86',
  };

  beforeEach(() => {
    // For screenshot modal
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${group.project.slug}/events/${event.id}/attachments/`,
      body: [],
    });

    // For release hovercard
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [],
    });
    // For release hovercard
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${group.project.slug}/releases/1.8/`,
      body: [],
    });
    // For release hovercard
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/1.8/deploys/`,
      body: [],
    });
  });

  it('hides user if there is no id, email, username, etc', () => {
    const eventWithoutUser = EventFixture({
      contexts: {
        user: {
          customProperty: 'customValue',
        },
      },
    });

    const {container} = render(
      <HighlightsIconSummary event={eventWithoutUser} group={group} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders user if there is id, email, username, etc', async () => {
    const eventWithUser = EventFixture({
      contexts: {
        user: {
          id: 'user id',
          email: 'user email',
          username: 'user username',
        },
      },
    });

    render(<HighlightsIconSummary event={eventWithUser} group={group} />);
    expect(screen.getByText('user email')).toBeInTheDocument();
    expect(screen.getByText('user username')).toBeInTheDocument();
    await userEvent.hover(screen.getByText('user username'));
    expect(await screen.findByText('User Username')).toBeInTheDocument();
  });

  it('renders appropriate icons and text', async () => {
    render(<HighlightsIconSummary event={event} group={group} />);
    expect(screen.getByText('Mac OS X')).toBeInTheDocument();
    expect(screen.getByText('10.15')).toBeInTheDocument();
    await userEvent.hover(screen.getByText('10.15'));
    expect(
      await screen.findByText('Client Operating System Version')
    ).toBeInTheDocument();
    expect(screen.getByText('CPython')).toBeInTheDocument();
    expect(screen.getByText('3.8.13')).toBeInTheDocument();
    await userEvent.hover(screen.getByText('3.8.13'));
    expect(await screen.findByText('Runtime Version')).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(4);
  });

  it('hides client_os and browser contexts for Meta-Framework backend issues', () => {
    const duplicateOsContextEvent = EventFixture({
      contexts: {
        client_os: {
          type: 'os',
          name: 'macOS',
          version: '15.3',
        },
        os: {
          type: 'os',
          name: 'Linux',
          version: '5.10.243',
        },
        runtime: {
          name: 'node',
          runtime: 'node v20.18.3',
          type: 'runtime',
          version: 'v20.18.3',
        },
      },
    });
    render(<HighlightsIconSummary event={duplicateOsContextEvent} group={group} />);
    expect(screen.getByText('Linux')).toBeInTheDocument();
    expect(screen.getByText('5.10.243')).toBeInTheDocument();
    expect(screen.getByText('node')).toBeInTheDocument();
    expect(screen.getByText('v20.18.3')).toBeInTheDocument();
    expect(screen.queryByText('macOS')).not.toBeInTheDocument();
    expect(screen.queryByText('15.3')).not.toBeInTheDocument();
  });

  it('deduplicates client_os and os contexts', () => {
    const duplicateOsContextEvent = EventFixture({
      contexts: {
        client_os: {
          type: 'os',
          name: 'macOS',
        },
        os: {
          type: 'os',
          name: 'macOS',
          version: '15.3',
        },
      },
    });
    render(<HighlightsIconSummary event={duplicateOsContextEvent} group={group} />);
    expect(screen.getByText('macOS')).toBeInTheDocument();
    expect(screen.getByText('15.3')).toBeInTheDocument();
  });

  it('deduplicates browser and runtime contexts', () => {
    const eventWithDuplicateContexts = EventFixture({
      contexts: {
        browser: {
          type: 'browser',
          name: 'Chrome',
          version: '120.0.0',
        },
        runtime: {
          type: 'runtime',
          name: 'Chrome',
          version: '120.0.0',
        },
      },
    });
    render(<HighlightsIconSummary event={eventWithDuplicateContexts} group={group} />);

    // Should only show Chrome once, as runtime context is preferred over browser
    const chromeElements = screen.getAllByText('Chrome');
    expect(chromeElements).toHaveLength(1);
    expect(screen.getByText('120.0.0')).toBeInTheDocument();
  });

  it('hides device for non mobile/native', () => {
    const groupWithPlatform = GroupFixture({
      project: ProjectFixture({
        platform: 'javascript',
      }),
    });
    const eventWithDevice = EventFixture({
      contexts: {
        ...TEST_EVENT_CONTEXTS,
        device: iosDeviceContext,
      },
    });

    render(<HighlightsIconSummary event={eventWithDevice} group={groupWithPlatform} />);
    expect(screen.queryByText('iPhone 13')).not.toBeInTheDocument();
    expect(screen.queryByText('x86')).not.toBeInTheDocument();
  });

  it('displays device for mobile/native event platforms', async () => {
    const groupWithPlatform = GroupFixture({
      project: ProjectFixture({
        platform: 'android',
      }),
    });
    const eventWithDevice = EventFixture({
      contexts: {
        ...TEST_EVENT_CONTEXTS,
        device: iosDeviceContext,
      },
    });

    render(<HighlightsIconSummary event={eventWithDevice} group={groupWithPlatform} />);
    expect(screen.getByText('iPhone 13')).toBeInTheDocument();
    expect(screen.getByText('x86')).toBeInTheDocument();
    await userEvent.hover(screen.getByText('x86'));
    expect(await screen.findByText('Device Architecture')).toBeInTheDocument();
  });

  it('renders release and environment tags', async () => {
    render(<HighlightsIconSummary event={event} group={group} />);
    expect(await screen.findByText('1.8')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
  });

  it('renders screenshot', async () => {
    const orgWithAttachments = OrganizationFixture({
      features: ['event-attachments'],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${orgWithAttachments.slug}/${group.project.slug}/events/${event.id}/attachments/`,
      body: [EventAttachmentFixture()],
    });

    render(<HighlightsIconSummary event={event} group={group} />, {
      organization: orgWithAttachments,
    });
    expect(await screen.findByRole('button', {name: 'Screenshot'})).toBeInTheDocument();
  });

  it('shortens long ruby runtime versions', async () => {
    const eventWithLongRuntime = EventFixture({
      contexts: {
        runtime: {
          name: 'ruby',
          version: 'ruby 3.2.6 (2024-10-30 revision 63aeb018eb) [arm64-darwin23]',
          type: 'runtime',
        },
      },
    });
    render(<HighlightsIconSummary event={eventWithLongRuntime} group={group} />);
    expect(await screen.findByText('3.2.6')).toBeInTheDocument();
  });

  it('shortens long ruby runtime versions with patch', async () => {
    const eventWithLongRuntime = EventFixture({
      contexts: {
        runtime: {
          name: 'ruby',
          version:
            'ruby 2.6.10p210 (2022-04-12 revision 67958) [universal.arm64e-darwin24]',
          type: 'runtime',
        },
      },
    });
    render(<HighlightsIconSummary event={eventWithLongRuntime} group={group} />);
    expect(await screen.findByText('2.6.10p210')).toBeInTheDocument();
  });

  it('shortens long operating system versions', async () => {
    const eventWithLongOperatingSystem = EventFixture({
      contexts: {
        os: {
          name: 'Darwin',
          version:
            'Darwin Kernel Version 24.3.0: Thu Jan 2 20:24:24 PST 2025; root:xnu-11215.81.4~3/RELEASE_ARM64_T6030',
          type: 'os',
        },
      },
    });
    render(<HighlightsIconSummary event={eventWithLongOperatingSystem} group={group} />);
    expect(await screen.findByText('24.3.0 (RELEASE_ARM64_T6030)')).toBeInTheDocument();
  });
});
