import {Event as EventFixture} from 'sentry-fixture/event';
import {
  EntryDebugMeta as EventEntryDebugMetaFixture,
  EventEntry as EventEntryFixture,
} from 'sentry-fixture/eventEntry';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EventEntries} from 'sentry/components/events/eventEntries';

describe('EventEntries', function () {
  const defaultProps = {
    organization: Organization(),
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
  });

  it('renders the replay section in the correct place', async function () {
    render(
      <EventEntries
        {...defaultProps}
        event={EventFixture({
          entries: [EventEntryFixture(), EventEntryDebugMetaFixture()],
          contexts: {
            replay_id: 1,
          },
        })}
      />,
      {organization: Organization({features: ['session-replay']})}
    );

    await screen.findByText(/message/i);

    const sections = screen.getAllByTestId(/event-section/);

    expect(sections).toHaveLength(5); //  event tags + 3 entries + event grouping

    // Replay should be after message but before images loaded
    expect(sections[1]).toHaveTextContent(/message/i);
    expect(sections[2]).toHaveTextContent(/replay/i);
    expect(sections[3]).toHaveTextContent(/images loaded/i);
  });
});
