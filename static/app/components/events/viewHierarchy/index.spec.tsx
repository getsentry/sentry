import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ViewHierarchy} from '.';

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
  it('allows selecting and deselecting through the tree to highlight node data', function () {
    render(<ViewHierarchy viewHierarchy={MOCK_DATA} />);

    expect(screen.queryByText('200')).not.toBeInTheDocument();

    userEvent.click(screen.getByText('Container - test_identifier'));

    expect(screen.getByText('200')).toBeInTheDocument();

    // 1 for the tree node, 1 for the details panel header
    expect(screen.getAllByText('Container - test_identifier')).toHaveLength(2);
    // 1 for the "identifier" value in the details panel
    expect(screen.getByText('Container')).toBeInTheDocument();

    // Click the node again
    userEvent.click(screen.getAllByText('Container - test_identifier')[0]);

    // 1 for the tree node
    expect(screen.getByText('Container - test_identifier')).toBeInTheDocument();
    expect(screen.queryByText('Container')).not.toBeInTheDocument();
  });

  it('can continue to make selections for inspecting data', function () {
    render(<ViewHierarchy viewHierarchy={MOCK_DATA} />);

    userEvent.click(screen.getByText('Container - test_identifier'));

    // 1 for the tree node, 1 for the details panel header
    expect(screen.getAllByText('Container - test_identifier')).toHaveLength(2);

    userEvent.click(screen.getByText('Nested Container - nested'));

    // 1 for the tree node, 1 for the details panel header
    expect(screen.getAllByText('Nested Container - nested')).toHaveLength(2);
    // Only visible in the tree node
    expect(screen.getByText('Container - test_identifier')).toBeInTheDocument();
  });
});
