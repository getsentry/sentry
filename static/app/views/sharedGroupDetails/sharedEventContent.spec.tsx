import {EventFixture} from 'sentry-fixture/event';
import {EventEntryFixture} from 'sentry-fixture/eventEntry';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {SharedViewOrganization} from 'sentry/types/organization';

import {SharedEventContent} from './sharedEventContent';

describe('SharedEventContent', () => {
  const organization: SharedViewOrganization = {slug: 'test-org', features: []};
  const project = ProjectFixture();

  it('renders event entries', () => {
    render(
      <SharedEventContent
        organization={organization}
        project={project}
        event={EventFixture({
          entries: [EventEntryFixture()],
        })}
      />
    );

    expect(screen.getByText(/message/i)).toBeInTheDocument();
  });

  it('renders latest event not available when no event', () => {
    render(<SharedEventContent organization={organization} project={project} />);

    expect(screen.getByText('Latest Event Not Available')).toBeInTheDocument();
  });

  it('renders user feedback when present', () => {
    const group = GroupFixture();
    render(
      <SharedEventContent
        organization={organization}
        project={project}
        group={group}
        event={EventFixture({
          userReport: {
            comments: 'This is broken!',
            dateCreated: '2024-01-01',
            email: 'user@example.com',
            eventID: '1',
            id: '1',
            issue: null,
            name: 'Test User',
            user: null,
          },
          entries: [],
        })}
      />
    );

    expect(screen.getByText('This is broken!')).toBeInTheDocument();
  });
});
