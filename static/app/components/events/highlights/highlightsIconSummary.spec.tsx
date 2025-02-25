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

describe('HighlightsIconSummary', function () {
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

  it('hides user if there is no id, email, username, etc', function () {
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

  it('renders user if there is id, email, username, etc', async function () {
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

  it('renders appropriate icons and text', async function () {
    render(<HighlightsIconSummary event={event} group={group} />);
    expect(screen.getByText('Mac OS X')).toBeInTheDocument();
    expect(screen.getByText('10.15')).toBeInTheDocument();
    await userEvent.hover(screen.getByText('10.15'));
    expect(await screen.findByText('Operating System Version')).toBeInTheDocument();
    expect(screen.getByText('CPython')).toBeInTheDocument();
    expect(screen.getByText('3.8.13')).toBeInTheDocument();
    await userEvent.hover(screen.getByText('3.8.13'));
    expect(await screen.findByText('Runtime Version')).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(4);
  });

  it('hides device for non mobile/native', function () {
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

  it('displays device for mobile/native event platforms', async function () {
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

  it('renders release and environment tags', async function () {
    render(<HighlightsIconSummary event={event} group={group} />);
    expect(await screen.findByText('1.8')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
  });

  it('renders screenshot', async function () {
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
});
