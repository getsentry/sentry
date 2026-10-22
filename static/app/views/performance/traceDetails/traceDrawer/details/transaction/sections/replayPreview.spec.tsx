import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';

import {ReplayPreview} from './replayPreview';

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
    render(
      <ReplayPreview
        replayId="test-replay-id"
        eventTimestampMs={1000}
        organization={organization}
      />,
      {organization}
    );

    expect(screen.getByText('Session Replay')).toBeInTheDocument();
  });

  it('should hide replay preview when user does not have granular replay permissions', () => {
    const orgWithGranularPermissions = OrganizationFixture({
      features: ['session-replay'],
      hasGranularReplayPermissions: true,
      replayAccessMembers: [999],
    });

    const {container} = render(
      <ReplayPreview
        replayId="test-replay-id"
        eventTimestampMs={1000}
        organization={orgWithGranularPermissions}
      />,
      {organization: orgWithGranularPermissions}
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('should return null when there is no replay id', () => {
    const {container} = render(
      <ReplayPreview
        replayId={undefined}
        eventTimestampMs={1000}
        organization={organization}
      />,
      {organization}
    );

    expect(container).toBeEmptyDOMElement();
  });
});
