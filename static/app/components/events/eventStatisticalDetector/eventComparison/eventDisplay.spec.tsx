import {Event} from 'sentry-fixture/event';
import {Project as ProjectMock} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Project} from 'sentry/types';

import {EventDisplay} from './eventDisplay';

describe('eventDisplay', () => {
  let mockProject: Project;

  beforeEach(() => {
    mockProject = ProjectMock();
  });

  it('renders an empty state if no events returned', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      method: 'GET',
      body: {data: []},
    });

    render(
      <EventDisplay
        durationBaseline={0}
        end={0}
        eventSelectLabel=""
        project={mockProject}
        start={0}
        transaction=""
      />
    );

    expect(await screen.findByText('Unable to find a sample event')).toBeInTheDocument();
  });

  it('renders an event with tags', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      method: 'GET',
      body: {
        data: [
          {
            timestamp: new Date().toISOString(),
            id: 'mock-id',
            'project.name': mockProject.name,
          },
        ],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events/${mockProject.slug}:mock-id/`,
      method: 'GET',
      body: Event({tags: [{key: 'mock-tag', value: 'mock-value'}]}),
    });

    render(
      <EventDisplay
        durationBaseline={0}
        end={0}
        eventSelectLabel=""
        project={mockProject}
        start={0}
        transaction=""
      />
    );

    expect(await screen.findByText('mock-tag')).toBeInTheDocument();
    expect(screen.getByText('mock-value')).toBeInTheDocument();
  });

  it('renders the event in the compact select with the defined label', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      method: 'GET',
      body: {
        data: [
          {
            timestamp: new Date().toISOString(),
            id: 'mock-id',
            'project.name': mockProject.name,
          },
        ],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events/${mockProject.slug}:mock-id/`,
      method: 'GET',
      body: Event({tags: [{key: 'mock-tag', value: 'mock-value'}]}),
    });

    render(
      <EventDisplay
        durationBaseline={0}
        end={0}
        eventSelectLabel="Prefix"
        project={mockProject}
        start={0}
        transaction=""
      />
    );

    expect(
      await screen.findByRole('button', {name: 'Prefix: mock-id'})
    ).toBeInTheDocument();
  });

  it('renders a button that links to the event detail page', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      method: 'GET',
      body: {
        data: [
          {
            timestamp: new Date().toISOString(),
            id: 'mock-id',
            'project.name': mockProject.name,
          },
        ],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events/${mockProject.slug}:mock-id/`,
      method: 'GET',
      body: Event({tags: [{key: 'mock-tag', value: 'mock-value'}]}),
    });

    render(
      <EventDisplay
        durationBaseline={0}
        end={0}
        eventSelectLabel="Prefix"
        project={mockProject}
        start={0}
        transaction=""
      />
    );

    expect(
      await screen.findByRole('button', {name: 'Full Event Details'})
    ).toHaveAttribute('href', '/organizations/org-slug/discover/project-slug:1/');
  });

  it('allows for pagination if there are more events loaded', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      method: 'GET',
      body: {
        data: [
          {
            timestamp: new Date().toISOString(),
            id: 'event1',
            'project.name': mockProject.name,
          },
          {
            timestamp: new Date().toISOString(),
            id: 'event2',
            'project.name': mockProject.name,
          },
        ],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events/${mockProject.slug}:event1/`,
      method: 'GET',
      body: Event({tags: [{key: 'mock-tag', value: 'mock-value-for-event1'}]}),
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events/${mockProject.slug}:event2/`,
      method: 'GET',
      body: Event({tags: [{key: 'mock-tag', value: 'mock-value-for-event2'}]}),
    });

    render(
      <EventDisplay
        durationBaseline={0}
        end={0}
        eventSelectLabel=""
        project={mockProject}
        start={0}
        transaction=""
      />
    );

    expect(await screen.findByText('event1')).toBeInTheDocument();
    expect(screen.getByText('mock-value-for-event1')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Previous Event'})).toBeDisabled();

    await userEvent.click(screen.getByRole('button', {name: 'Next Event'}));

    expect(await screen.findByText('event2')).toBeInTheDocument();
    expect(screen.getByText('mock-value-for-event2')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next Event'})).toBeDisabled();
  });
});
