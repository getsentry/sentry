import {Group} from 'fixtures/js-stubs/group';
import {Organization} from 'fixtures/js-stubs/organization';
import {Project} from 'fixtures/js-stubs/project';
import {Team} from 'fixtures/js-stubs/team';
import {User} from 'fixtures/js-stubs/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openCreateOwnershipRule} from 'sentry/actionCreators/modal';
import OwnedBy from 'sentry/components/group/ownedBy';
import MemberListStore from 'sentry/stores/memberListStore';
import {buildTeamId, buildUserId} from 'sentry/utils';

jest.mock('sentry/actionCreators/modal');

describe('Group > OwnedBy', () => {
  it('renders unowned', () => {
    const group = Group();
    render(<OwnedBy group={group} organization={Organization()} project={Project()} />);
    expect(screen.getByText('No-one')).toBeInTheDocument();
  });

  it('renders team owner', () => {
    const team = Team();
    const group = Group({
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
        organization={Organization()}
        project={Project({teams: [team]})}
      />
    );
    expect(screen.getByText(`#${team.slug}`)).toBeInTheDocument();
  });

  it('renders member owner', () => {
    const user = User();
    MemberListStore.loadInitialData([user]);
    const group = Group({
      owners: [
        {
          date_added: new Date(),
          owner: buildUserId(user.id),
          type: 'codeowners',
        },
      ],
    });
    render(<OwnedBy group={group} organization={Organization()} project={Project()} />);
    expect(screen.getByText(user.name)).toBeInTheDocument();
  });

  it('does not render suspect commit', () => {
    const user = User();
    MemberListStore.loadInitialData([user]);
    const group = Group({
      owners: [
        {
          date_added: new Date(),
          owner: buildUserId(user.id),
          type: 'suspectCommit',
        },
      ],
    });
    render(<OwnedBy group={group} organization={Organization()} project={Project()} />);
    expect(screen.getByText('No-one')).toBeInTheDocument();
  });

  it('allows project:write to edit owners', () => {
    render(<OwnedBy group={Group()} organization={Organization()} project={Project()} />);

    userEvent.click(screen.getByLabelText('Create Ownership Rule'));

    expect(openCreateOwnershipRule).toHaveBeenCalledWith(
      expect.objectContaining({issueId: '1'})
    );
  });
});
