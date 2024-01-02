import {Event as EventFixture} from 'sentry-fixture/event';
import {EventAttachment} from 'sentry-fixture/eventAttachment';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EventViewHierarchy} from './eventViewHierarchy';

// Mocks for useVirtualizedTree hook
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserver;
window.Element.prototype.scrollTo = jest.fn();

const DEFAULT_VALUES = {alpha: 1, height: 1, width: 1, x: 1, y: 1, visible: true};
const MOCK_DATA = JSON.stringify({
  rendering_system: 'test-rendering-system',
  windows: [
    {
      ...DEFAULT_VALUES,
      id: 'parent',
      type: 'Container',
      identifier: 'test_identifier',
      x: 200,
      children: [
        {
          ...DEFAULT_VALUES,
          id: 'intermediate',
          type: 'Nested Container',
          identifier: 'nested',
          children: [
            {
              ...DEFAULT_VALUES,
              id: 'leaf',
              type: 'Text',
              children: [],
            },
          ],
        },
      ],
    },
  ],
});

const organization = Organization({
  features: ['event-attachments'],
});
const event = EventFixture();

describe('Event View Hierarchy', function () {
  let mockAttachment;
  let mockProject;
  beforeEach(function () {
    mockAttachment = EventAttachment({type: 'event.view_hierarchy'});
    mockProject = ProjectFixture();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${mockProject.slug}/events/${event.id}/attachments/`,
      body: [mockAttachment],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${mockProject.slug}/events/${mockAttachment.event_id}/attachments/${mockAttachment.id}/?download`,
      body: MOCK_DATA,
    });
  });

  it('renders nothing when no view_hierarchy attachments', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${mockProject.slug}/events/${event.id}/attachments/`,
      body: [EventAttachment()],
    });

    const {container} = render(
      <EventViewHierarchy project={mockProject} event={event} />,
      {
        organization,
      }
    );

    // No loading state so nothing to wait for
    await tick();

    expect(container).toBeEmptyDOMElement();
  });

  it('does not collapse all nodes when update triggers re-render', async function () {
    const {rerender} = render(
      <EventViewHierarchy project={mockProject} event={event} />,
      {
        organization,
      }
    );

    expect(await screen.findByText('Nested Container - nested')).toBeInTheDocument();

    rerender(<EventViewHierarchy project={mockProject} event={event} />);

    expect(await screen.findByText('Nested Container - nested')).toBeInTheDocument();
  });
});
