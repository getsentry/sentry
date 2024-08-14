import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {UptimeDataSection} from 'sentry/components/events/interfaces/uptime/uptimeDataSection';
import {
  type GroupActivity,
  GroupActivityType,
  GroupStatus,
  IssueCategory,
} from 'sentry/types/group';

describe('Uptime Data Section', function () {
  it('displays downtime according to activity', function () {
    const activity: GroupActivity[] = [
      {
        data: {},
        id: '1',
        dateCreated: '2024-06-20T20:36:51.884284Z',
        project: ProjectFixture(),
        type: GroupActivityType.FIRST_SEEN,
      },
      {
        data: {},
        id: '2',
        dateCreated: '2024-06-21T20:36:51.884284Z',
        project: ProjectFixture(),
        type: GroupActivityType.SET_RESOLVED,
      },
    ];

    const group = GroupFixture({
      status: GroupStatus.RESOLVED,
      issueCategory: IssueCategory.UPTIME,
      activity,
    });

    render(<UptimeDataSection group={group} />);

    expect(screen.getByText('1 day')).toBeInTheDocument();
  });
});
