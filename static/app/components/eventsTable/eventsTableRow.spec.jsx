import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import EventsTableRow from 'sentry/components/eventsTable/eventsTableRow';

describe('EventsTableRow', function () {
  const {organization, router, routerContext} = initializeOrg({
    organization: TestStubs.Organization(),
    project: TestStubs.Project(),
    projects: [TestStubs.Project()],
    router: {
      routes: [
        {
          path: '/',
        },
        {
          path: '/organizations/:orgId/issues/:groupId/',
        },
        {
          path: 'events/',
        },
      ],
    },
  });

  it('renders', function () {
    const {container} = render(
      <table>
        <tbody>
          <EventsTableRow
            organization={organization}
            tagList={[]}
            {...{orgId: 'orgId', projectId: 'projectId', groupId: 'groupId'}}
            event={TestStubs.DetailedEvents()[0]}
          />
        </tbody>
      </table>
    );
    expect(container).toSnapshot();
  });

  it('does not render the replay button when there is no replay', () => {
    render(
      <table>
        <tbody>
          <EventsTableRow
            organization={organization}
            tagList={[
              {
                key: 'replayId',
                name: 'Replayid',
                totalValues: 5,
              },
            ]}
            {...{orgId: 'orgId', projectId: 'projectId', groupId: 'groupId'}}
            event={TestStubs.DetailedEvents()[0]}
          />
        </tbody>
      </table>,
      {context: routerContext, router}
    );

    expect(screen.queryAllByRole('cell').length).toBe(2);
    expect(screen.queryByLabelText('View Full Replay')).not.toBeInTheDocument();
  });

  it('renders the replay column with a correct link', () => {
    const event = TestStubs.DetailedEvents()[0];

    render(
      <table>
        <tbody>
          <EventsTableRow
            organization={organization}
            tagList={[
              {
                key: 'replayId',
                name: 'Replayid',
                totalValues: 5,
              },
            ]}
            {...{orgId: 'orgId', projectId: 'projectId', groupId: 'groupId'}}
            event={{
              ...event,
              tags: [
                {
                  key: 'replayId',
                  value: 'test-replay-id',
                },
              ],
            }}
          />
        </tbody>
      </table>,
      {context: routerContext, router}
    );

    expect(screen.queryAllByRole('cell').length).toBe(2);
    expect(screen.queryByLabelText('View Full Replay')).toHaveAttribute(
      'href',
      `/organizations/org-slug/replays/projectId:test-replay-id/?event_t=${new Date(
        event.dateCreated
      ).getTime()}&referrer=%2Forganizations%2F%3AorgId%2Fissues%2F%3AgroupId%2Fevents%2F`
    );
  });
});
