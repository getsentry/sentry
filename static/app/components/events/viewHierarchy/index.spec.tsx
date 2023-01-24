import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {ViewHierarchy} from '.';

// Mocks for useVirtualizedTree hook
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserver;
window.Element.prototype.scrollTo = jest.fn();
window.Element.prototype.scrollIntoView = jest.fn();

const DEFAULT_VALUES = {alpha: 1, height: 1, width: 1, x: 1, y: 1, visible: true};
const MOCK_DATA = {
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
};

describe('View Hierarchy', function () {
  it('can continue make selections for inspecting data', function () {
    render(<ViewHierarchy viewHierarchy={MOCK_DATA} />);

    // 1 for the tree node, 1 for the details panel header
    expect(screen.getAllByText('Container - test_identifier')).toHaveLength(2);

    userEvent.click(screen.getByText('Nested Container - nested'));

    // 1 for the tree node, 1 for the details panel header
    expect(screen.getAllByText('Nested Container - nested')).toHaveLength(2);
    // Only visible in the tree node
    expect(screen.getByText('Container - test_identifier')).toBeInTheDocument();

    userEvent.click(screen.getByText('Text'));

    // 1 for the tree node, 1 for the details panel header, 1 for the details value
    expect(screen.getAllByText('Text')).toHaveLength(3);
    // Only visible in the tree node
    expect(screen.getByText('Nested Container - nested')).toBeInTheDocument();
  });

  it('can expand and collapse by clicking the icon', function () {
    render(<ViewHierarchy viewHierarchy={MOCK_DATA} />);

    expect(screen.queryByText('Text')).toBeInTheDocument();

    userEvent.click(
      within(screen.getByLabelText('Nested Container - nested')).getByRole('button', {
        name: 'Collapse',
      })
    );

    expect(screen.queryByText('Text')).not.toBeInTheDocument();

    userEvent.click(screen.getByRole('button', {name: 'Expand'}));

    expect(screen.queryByText('Text')).toBeInTheDocument();
  });

  it('can navigate with keyboard shortcuts after a selection', function () {
    render(<ViewHierarchy viewHierarchy={MOCK_DATA} />);

    userEvent.click(screen.getAllByText('Container - test_identifier')[0]);

    userEvent.keyboard('{ArrowDown}');

    // 1 for the tree node, 1 for the details panel header
    expect(screen.getAllByText('Nested Container - nested')).toHaveLength(2);
  });

  it('can expand/collapse with the keyboard', function () {
    render(<ViewHierarchy viewHierarchy={MOCK_DATA} />);

    userEvent.click(screen.getAllByText('Nested Container - nested')[0]);

    userEvent.keyboard('{Enter}');

    expect(screen.queryByText('Text')).not.toBeInTheDocument();

    userEvent.keyboard('{Enter}');

    expect(screen.getByText('Text')).toBeInTheDocument();
  });
});
