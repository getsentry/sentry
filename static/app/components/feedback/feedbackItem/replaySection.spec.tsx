import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';

import ReplaySection from './replaySection';

jest.mock('sentry/components/events/eventReplay/replayClipPreview', () => {
  return function MockReplayClipPreview() {
    return <div data-test-id="replay-clip-preview">Replay Clip Preview</div>;
  };
});

describe('ReplaySection', () => {
  const user = UserFixture({id: '1'});
  const organization = OrganizationFixture({
    features: ['session-replay'],
  });

  beforeEach(() => {
    ConfigStore.set('user', user);
  });

  it('should render replay section when user has access', async () => {
    render(
      <ReplaySection
        eventTimestampMs={Date.now()}
        organization={organization}
        replayId="test-replay-id"
      />
    );

    expect(await screen.findByTestId('replay-clip-preview')).toBeInTheDocument();
  });

  it('should hide replay section when user does not have granular replay permissions', () => {
    const orgWithGranularPermissions = OrganizationFixture({
      features: ['session-replay', 'granular-replay-permissions'],
      hasGranularReplayPermissions: true,
      replayAccessMembers: [999], // User ID 1 is not in this list
    });

    const {container} = render(
      <ReplaySection
        eventTimestampMs={Date.now()}
        organization={orgWithGranularPermissions}
        replayId="test-replay-id"
      />,
      {
        organization: orgWithGranularPermissions,
      }
    );

    expect(screen.queryByTestId('replay-clip-preview')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
