import {EventFixture} from 'sentry-fixture/event';
import {EntryDebugMetaFixture, EventEntryFixture} from 'sentry-fixture/eventEntry';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {EventEntries} from 'sentry/components/events/eventEntries';

describe('EventEntries', function () {
  const defaultProps = {
    organization: OrganizationFixture(),
    project: ProjectFixture(),
    event: EventFixture(),
    location: LocationFixture(),
  };

  beforeEach(function () {
    const project = ProjectFixture({platform: 'javascript'});

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/events/1/grouping-info/',
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/events/1/committers/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project],
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/events/1/actionable-items/',
    });
  });

  it('renders the replay section in the correct place', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {data: {dismissed_ts: null}},
    });
    render(
      <EventEntries
        {...defaultProps}
        event={EventFixture({
          entries: [EventEntryFixture(), EntryDebugMetaFixture()],
          contexts: {
            replay_id: 1,
          },
        })}
      />,
      {organization: OrganizationFixture({features: ['session-replay']})}
    );

    await waitFor(() => {
      expect(screen.getAllByTestId(/event-section/)).toHaveLength(4); //  event tags + 2 entries + event grouping
    });

    const sections = screen.getAllByTestId(/event-section/);

    // Replay should be after message but before images loaded
    expect(sections[0]).toHaveTextContent(/message/i);
    expect(sections[1]).toHaveTextContent(/replay/i);
    expect(sections[2]).toHaveTextContent(/images loaded/i);
  });
});
