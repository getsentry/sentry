import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import type {EventTransaction} from 'sentry/types/event';

import ReplayPreview from './replayPreview';

jest.mock('sentry/components/events/eventReplay/replayClipPreview', () => {
  return function MockReplayClipPreview() {
    return <div data-test-id="replay-clip-preview">Replay Clip Preview</div>;
  };
});

describe('ReplayPreview', () => {
  const user = UserFixture({id: '1'});
  const organization = OrganizationFixture({
    features: ['session-replay'],
  });

  beforeEach(() => {
    ConfigStore.set('user', user);
  });

  it('should render replay preview when user has access', () => {
    const event = EventFixture({
      contexts: {
        replay: {
          replay_id: 'test-replay-id',
        },
      },
    }) as EventTransaction;

    render(<ReplayPreview event={event} organization={organization} />, {
      organization,
    });

    expect(screen.getByText('Session Replay')).toBeInTheDocument();
  });

  it('should hide replay preview when user does not have granular replay permissions', () => {
    const orgWithGranularPermissions = OrganizationFixture({
      features: ['session-replay', 'granular-replay-permissions'],
      hasGranularReplayPermissions: true,
      replayAccessMembers: [999], // User ID 1 is not in this list
    });

    const event = EventFixture({
      contexts: {
        replay: {
          replay_id: 'test-replay-id',
        },
      },
    }) as EventTransaction;

    const {container} = render(
      <ReplayPreview event={event} organization={orgWithGranularPermissions} />,
      {
        organization: orgWithGranularPermissions,
      }
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('should return null when event has no replay id', () => {
    const event = EventFixture({
      contexts: {},
    }) as EventTransaction;

    const {container} = render(
      <ReplayPreview event={event} organization={organization} />,
      {
        organization,
      }
    );

    expect(container).toBeEmptyDOMElement();
  });
});
