import {render, screen} from 'sentry-test/reactTestingLibrary';

import OwnedBy from 'sentry/components/group/ownedBy';
import MemberListStore from 'sentry/stores/memberListStore';
import {buildTeamId, buildUserId} from 'sentry/utils';

describe('Group > OwnedBy', () => {
  it('renders unowned', () => {
    const group = TestStubs.Group();
    render(
      <OwnedBy
        group={group}
        organization={TestStubs.Organization()}
        project={TestStubs.Project()}
      />
    );
    expect(screen.getByText('No-one')).toBeInTheDocument();
  });

  it('renders team owner', () => {
    const team = TestStubs.Team();
    const group = TestStubs.Group({
      owners: [
        {
          date_added: new Date(),
          owner: buildTeamId(team.id),
          type: 'codeowners',
        },
      ],
    });
    render(
      <OwnedBy
        group={group}
        organization={TestStubs.Organization()}
        project={TestStubs.Project({teams: [team]})}
      />
    );
    expect(screen.getByText(`#${team.slug}`)).toBeInTheDocument();
  });

  it('renders member owner', () => {
    const user = TestStubs.User();
    MemberListStore.loadInitialData([user]);
    const group = TestStubs.Group({
      owners: [
        {
          date_added: new Date(),
          owner: buildUserId(user.id),
          type: 'codeowners',
        },
      ],
    });
    render(
      <OwnedBy
        group={group}
        organization={TestStubs.Organization()}
        project={TestStubs.Project()}
      />
    );
    expect(screen.getByText(user.name)).toBeInTheDocument();
  });

  it('does not render suspect commit', () => {
    const user = TestStubs.User();
    MemberListStore.loadInitialData([user]);
    const group = TestStubs.Group({
      owners: [
        {
          date_added: new Date(),
          owner: buildUserId(user.id),
          type: 'suspectCommit',
        },
      ],
    });
    render(
      <OwnedBy
        group={group}
        organization={TestStubs.Organization()}
        project={TestStubs.Project()}
      />
    );
    expect(screen.getByText('No-one')).toBeInTheDocument();
  });
});
