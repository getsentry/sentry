import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  type GroupActivity,
  GroupActivityType,
  GroupStatus,
  IssueCategory,
} from 'sentry/types/group';

import {UptimeDataSection} from './uptimeDataSection';

describe('Uptime Data Section', function () {
  it('displays downtime according to activity', function () {
    const project = ProjectFixture();

    const activity: GroupActivity[] = [
      {
        data: {},
        id: '2',
        dateCreated: '2024-06-21T20:36:51.884284Z',
        project,
        type: GroupActivityType.SET_RESOLVED,
      },
      {
        data: {},
        id: '1',
        dateCreated: '2024-06-20T20:36:51.884284Z',
        project,
        type: GroupActivityType.FIRST_SEEN,
      },
    ];

    const group = GroupFixture({
      status: GroupStatus.RESOLVED,
      issueCategory: IssueCategory.UPTIME,
      activity,
    });

    const event = EventFixture({
      tags: [
        {
          key: 'uptime_rule',
          value: '1234',
        },
      ],
    });

    render(<UptimeDataSection event={event} group={group} project={project} />);

    expect(screen.getByText('1 day')).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Uptime Alert Rule'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/alerts/rules/uptime/project-slug/1234/details/'
    );
  });

  it('displays downtime according to multiple activities', function () {
    const project = ProjectFixture();

    const activity: GroupActivity[] = [
      {
        data: {},
        id: '4',
        dateCreated: '2024-06-22T22:36:51.884284Z',
        project,
        type: GroupActivityType.SET_RESOLVED,
      },
      {
        data: {},
        id: '3',
        dateCreated: '2024-06-22T20:36:51.884284Z',
        project,
        type: GroupActivityType.SET_REGRESSION,
      },
      {
        data: {},
        id: '2',
        dateCreated: '2024-06-21T20:36:51.884284Z',
        project,
        type: GroupActivityType.SET_RESOLVED,
      },
      {
        data: {},
        id: '1',
        dateCreated: '2024-06-20T20:36:51.884284Z',
        project,
        type: GroupActivityType.FIRST_SEEN,
      },
    ];

    const group = GroupFixture({
      status: GroupStatus.RESOLVED,
      issueCategory: IssueCategory.UPTIME,
      activity,
    });

    const event = EventFixture({
      tags: [
        {
          key: 'uptime_rule',
          value: '1234',
        },
      ],
    });

    render(<UptimeDataSection event={event} group={group} project={project} />);

    // Shows the second downtime duration
    expect(screen.getByText('2 hours')).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Uptime Alert Rule'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/alerts/rules/uptime/project-slug/1234/details/'
    );
  });
});
