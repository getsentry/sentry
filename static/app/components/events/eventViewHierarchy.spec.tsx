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

describe('Event View Hierarchy', function () {
  let mockAttachment;
  beforeEach(function () {
    mockAttachment = TestStubs.EventAttachment();
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/mock/events/${mockAttachment.event_id}/attachments/${mockAttachment.id}/?download`,
      body: MOCK_DATA,
    });
  });

  it('does not collapse all nodes when update triggers re-render', async function () {
    const {rerender} = render(
      <EventViewHierarchy projectSlug="mock" viewHierarchies={[mockAttachment]} />
    );

    expect(await screen.findByText('Nested Container - nested')).toBeInTheDocument();

    rerender(
      <EventViewHierarchy projectSlug="mock" viewHierarchies={[mockAttachment]} />
    );

    expect(await screen.findByText('Nested Container - nested')).toBeInTheDocument();
  });
});
