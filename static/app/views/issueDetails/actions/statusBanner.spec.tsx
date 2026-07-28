import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {GroupStatus, GroupSubstatus} from 'sentry/types/group';
import {StatusBanner} from 'sentry/views/issueDetails/actions/statusBanner';

const project = ProjectFixture();
const actor = UserFixture({name: 'David Cramer'});

describe('StatusBanner', () => {
  it('renders the activity resolved presentation behind the flag', () => {
    render(
      <StatusBanner
        group={GroupFixture({
          status: GroupStatus.RESOLVED,
          statusDetails: {},
        })}
        project={project}
      />,
      {
        organization: OrganizationFixture({features: ['issue-activity-feed-v2']}),
      }
    );

    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(screen.getByRole('img', {name: 'Fix Applied'})).toBeInTheDocument();
    expect(screen.queryByTestId('icon-check-mark')).not.toBeInTheDocument();
  });

  it('renders the activity archived presentation and reason behind the flag', () => {
    render(
      <StatusBanner
        group={GroupFixture({
          status: GroupStatus.IGNORED,
          substatus: GroupSubstatus.ARCHIVED_UNTIL_CONDITION_MET,
          statusDetails: {actor, ignoreCount: 50},
        })}
        project={project}
      />,
      {
        organization: OrganizationFixture({features: ['issue-activity-feed-v2']}),
      }
    );

    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(
      screen.getByText('David Cramer archived until 50 more events occur')
    ).toBeInTheDocument();
    expect(screen.getByRole('img', {name: 'Archived'})).toBeInTheDocument();
    expect(screen.queryByTestId('icon-check-mark')).not.toBeInTheDocument();
  });

  it('keeps the default archived presentation without the flag', () => {
    render(
      <StatusBanner
        group={GroupFixture({
          status: GroupStatus.IGNORED,
          substatus: GroupSubstatus.ARCHIVED_FOREVER,
          statusDetails: {},
        })}
        project={project}
      />
    );

    expect(screen.getByText('This issue has been archived forever.')).toBeInTheDocument();
    expect(screen.getByTestId('icon-check-mark')).toBeInTheDocument();
    expect(screen.queryByRole('img', {name: 'Archived'})).not.toBeInTheDocument();
  });
});
