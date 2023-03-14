import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openIssueOwnershipRuleModal} from 'sentry/actionCreators/modal';
import OwnedBy from 'sentry/components/group/ownedBy';
import MemberListStore from 'sentry/stores/memberListStore';
import {buildTeamId, buildUserId} from 'sentry/utils';

jest.mock('sentry/actionCreators/modal');

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
    expect(screen.getByText('No one')).toBeInTheDocument();
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
    expect(screen.getByText('No one')).toBeInTheDocument();
  });

  it('allows project:write to edit owners', async () => {
    render(
      <OwnedBy
        group={TestStubs.Group()}
        organization={TestStubs.Organization()}
        project={TestStubs.Project()}
      />
    );

    await userEvent.click(screen.getByLabelText('Create Ownership Rule'));

    expect(openIssueOwnershipRuleModal).toHaveBeenCalledWith(
      expect.objectContaining({issueId: '1'})
    );
  });
});
