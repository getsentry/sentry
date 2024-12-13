import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import {EventOrGroupType} from 'sentry/types/event';

import EventMessage from './eventMessage';

describe('EventMessage', () => {
  const group = GroupFixture();

  beforeEach(() => {
    ConfigStore.init();
  });

  it('renders error message', () => {
    render(
      <EventMessage data={group} message="Test message" type={EventOrGroupType.ERROR} />
    );
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('renders location (with issue-stream-table-layout)', () => {
    const organization = OrganizationFixture({
      features: ['issue-stream-table-layout'],
    });

    render(
      <EventMessage data={group} message="Test message" type={EventOrGroupType.ERROR} />,
      {organization}
    );

    expect(
      screen.getByText('fetchData(app/components/group/suggestedOwners/suggestedOwners)')
    ).toBeInTheDocument();
  });

  it('renders "No error message" when message is not provided', () => {
    render(<EventMessage data={group} message={null} type={EventOrGroupType.ERROR} />);
    expect(screen.getByText('(No error message)')).toBeInTheDocument();
  });

  it('renders error level indicator dot', () => {
    render(
      <EventMessage
        data={group}
        message="Test message"
        type={EventOrGroupType.ERROR}
        level="error"
      />
    );
    expect(screen.getByText('Level: Error')).toBeInTheDocument();
  });

  it('renders unhandled tag', () => {
    render(
      <EventMessage
        data={group}
        message="Test message"
        type={EventOrGroupType.ERROR}
        showUnhandled
      />
    );
    expect(screen.getByText('Unhandled')).toBeInTheDocument();
  });
});
