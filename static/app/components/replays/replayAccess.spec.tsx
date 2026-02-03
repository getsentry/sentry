import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';

import {ReplayAccess, ReplayAccessFallbackAlert} from './replayAccess';

describe('ReplayAccess', () => {
  const user = UserFixture({id: '1'});

  beforeEach(() => {
    ConfigStore.set('user', user);
  });

  it('renders children when granular-replay-permissions feature is not enabled', () => {
    const organization = OrganizationFixture({
      features: [],
    });

    render(
      <ReplayAccess fallback={<div>No access</div>}>
        <div>Has access</div>
      </ReplayAccess>,
      {organization}
    );

    expect(screen.getByText('Has access')).toBeInTheDocument();
    expect(screen.queryByText('No access')).not.toBeInTheDocument();
  });

  it('renders children when hasGranularReplayPermissions is false', () => {
    const organization = OrganizationFixture({
      features: ['granular-replay-permissions'],
      hasGranularReplayPermissions: false,
    });

    render(
      <ReplayAccess fallback={<div>No access</div>}>
        <div>Has access</div>
      </ReplayAccess>,
      {organization}
    );

    expect(screen.getByText('Has access')).toBeInTheDocument();
    expect(screen.queryByText('No access')).not.toBeInTheDocument();
  });

  it('renders children when user is in replayAccessMembers', () => {
    const organization = OrganizationFixture({
      features: ['granular-replay-permissions'],
      hasGranularReplayPermissions: true,
      replayAccessMembers: [1],
    });

    render(
      <ReplayAccess fallback={<div>No access</div>}>
        <div>Has access</div>
      </ReplayAccess>,
      {organization}
    );

    expect(screen.getByText('Has access')).toBeInTheDocument();
    expect(screen.queryByText('No access')).not.toBeInTheDocument();
  });

  it('renders fallback when user is not in replayAccessMembers', () => {
    const organization = OrganizationFixture({
      features: ['granular-replay-permissions'],
      hasGranularReplayPermissions: true,
      replayAccessMembers: [999],
    });

    render(
      <ReplayAccess fallback={<div>No access</div>}>
        <div>Has access</div>
      </ReplayAccess>,
      {organization}
    );

    expect(screen.queryByText('Has access')).not.toBeInTheDocument();
    expect(screen.getByText('No access')).toBeInTheDocument();
  });

  it('renders null fallback by default when user does not have access', () => {
    const organization = OrganizationFixture({
      features: ['granular-replay-permissions'],
      hasGranularReplayPermissions: true,
      replayAccessMembers: [999],
    });

    const {container} = render(
      <ReplayAccess>
        <div>Has access</div>
      </ReplayAccess>,
      {organization}
    );

    expect(screen.queryByText('Has access')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ReplayAccessFallbackAlert', () => {
  it('renders the access denied alert message', () => {
    render(<ReplayAccessFallbackAlert />);

    expect(screen.getByText("You don't have access to this feature")).toBeInTheDocument();
  });
});
