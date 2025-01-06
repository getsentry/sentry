import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

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

  it('hides user if there is no id, email, username, etc', function () {
    const eventWithoutUser = EventFixture({
      contexts: {
        user: {
          customProperty: 'customValue',
        },
      },
    });

    const {container} = render(<HighlightsIconSummary event={eventWithoutUser} />);
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

    render(<HighlightsIconSummary event={eventWithUser} />);
    expect(screen.getByText('user email')).toBeInTheDocument();
    expect(screen.getByText('user username')).toBeInTheDocument();
    await userEvent.hover(screen.getByText('user username'));
    expect(await screen.findByText('User Username')).toBeInTheDocument();
  });

  it('renders appropriate icons and text', async function () {
    render(<HighlightsIconSummary event={event} />);
    expect(screen.getByText('Mac OS X')).toBeInTheDocument();
    expect(screen.getByText('10.15')).toBeInTheDocument();
    await userEvent.hover(screen.getByText('10.15'));
    expect(await screen.findByText('Operating System Version')).toBeInTheDocument();
    expect(screen.getByText('CPython')).toBeInTheDocument();
    expect(screen.getByText('3.8.13')).toBeInTheDocument();
    await userEvent.hover(screen.getByText('3.8.13'));
    expect(await screen.findByText('Runtime Version')).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('hides device for non mobile/native', function () {
    const eventWithDevice = EventFixture({
      contexts: {
        ...TEST_EVENT_CONTEXTS,
        device: iosDeviceContext,
      },
      platform: 'javascript',
    });

    render(<HighlightsIconSummary event={eventWithDevice} />);
    expect(screen.queryByText('iPhone 13')).not.toBeInTheDocument();
    expect(screen.queryByText('x86')).not.toBeInTheDocument();
  });

  it('displays device for mobile/native event platforms', async function () {
    const eventWithDevice = EventFixture({
      contexts: {
        ...TEST_EVENT_CONTEXTS,
        device: iosDeviceContext,
      },
      platform: 'android',
    });

    render(<HighlightsIconSummary event={eventWithDevice} />);
    expect(screen.getByText('iPhone 13')).toBeInTheDocument();
    expect(screen.getByText('x86')).toBeInTheDocument();
    await userEvent.hover(screen.getByText('x86'));
    expect(await screen.findByText('Device Architecture')).toBeInTheDocument();
  });

  it('renders release and environment tags', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${group.project.slug}/releases/1.8/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/1.8/deploys/`,
      body: [],
    });
    render(<HighlightsIconSummary event={event} group={group} />);
    expect(await screen.findByText('1.8')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
  });
});
