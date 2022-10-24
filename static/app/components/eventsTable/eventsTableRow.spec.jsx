import {render, screen} from 'sentry-test/reactTestingLibrary';

import Button from 'sentry/components/button';
import EventsTableRow from 'sentry/components/eventsTable/eventsTableRow';

jest.mock('sentry/utils/useRoutes', () => ({
  useRoutes: jest.fn(() => [
    {
      path: '/',
    },
    {
      path: '/organizations/:orgId/issues/:groupId/',
    },
    {
      path: 'events/',
    },
  ]),
}));

jest.mock('sentry/components/button', () => jest.fn(() => null));

describe('EventsTableRow', function () {
  it('renders', function () {
    const {container} = render(
      <table>
        <tbody>
          <EventsTableRow
            organization={TestStubs.Organization()}
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
            organization={TestStubs.Organization()}
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
      </table>
    );

    expect(screen.queryAllByRole('cell').length).toBe(2);
    expect(Button).not.toHaveBeenCalled();
  });

  it('renders the replay column with a correct link', () => {
    const event = TestStubs.DetailedEvents()[0];

    render(
      <table>
        <tbody>
          <EventsTableRow
            organization={TestStubs.Organization()}
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
      </table>
    );

    expect(screen.queryAllByRole('cell').length).toBe(2);
    expect(Button).toHaveBeenCalledWith(
      expect.objectContaining({
        'aria-label': 'View Full Replay',
        to: expect.objectContaining({
          pathname: '/organizations/org-slug/replays/projectId:test-replay-id/',
          query: {
            event_t: new Date(event.dateCreated).getTime(),
            referrer: '%2Forganizations%2F%3AorgId%2Fissues%2F%3AgroupId%2Fevents%2F',
          },
        }),
      }),
      {}
    );
  });
});
