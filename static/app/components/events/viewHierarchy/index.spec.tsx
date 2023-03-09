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
const DEFAULT_MOCK_DATA = {
  rendering_system: 'test-rendering-system',
  windows: [
    {
      ...DEFAULT_VALUES,
      type: 'Container',
      identifier: 'test_identifier',
      x: 200,
      children: [
        {
          ...DEFAULT_VALUES,
          type: 'Nested Container',
          x: 10,
          y: 10,
          width: 3,
          height: 4,
          identifier: 'nested',
          children: [
            {
              ...DEFAULT_VALUES,
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
  let MOCK_DATA;
  let project;
  beforeEach(() => {
    MOCK_DATA = DEFAULT_MOCK_DATA;
    project = TestStubs.Project();
  });

  it('can continue make selections for inspecting data', function () {
    render(<ViewHierarchy viewHierarchy={MOCK_DATA} project={project} />);

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
    render(<ViewHierarchy viewHierarchy={MOCK_DATA} project={project} />);

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
    render(<ViewHierarchy viewHierarchy={MOCK_DATA} project={project} />);

    userEvent.click(screen.getAllByText('Container - test_identifier')[0]);

    userEvent.keyboard('{ArrowDown}');

    // 1 for the tree node, 1 for the details panel header
    expect(screen.getAllByText('Nested Container - nested')).toHaveLength(2);
  });

  it('can expand/collapse with the keyboard', function () {
    render(<ViewHierarchy viewHierarchy={MOCK_DATA} project={project} />);

    userEvent.click(screen.getAllByText('Nested Container - nested')[0]);

    userEvent.keyboard('{Enter}');

    expect(screen.queryByText('Text')).not.toBeInTheDocument();

    userEvent.keyboard('{Enter}');

    expect(screen.getByText('Text')).toBeInTheDocument();
  });

  it('can render multiple windows together', function () {
    MOCK_DATA.windows = [
      ...MOCK_DATA.windows,
      {
        ...DEFAULT_VALUES,
        type: 'Second Window',
        children: [
          {
            ...DEFAULT_VALUES,
            type: 'Second Window Child',
            children: [],
          },
        ],
      },
    ];
    render(<ViewHierarchy viewHierarchy={MOCK_DATA} project={project} />);

    expect(screen.getByText('Second Window')).toBeInTheDocument();
    expect(screen.getByText('Second Window Child')).toBeInTheDocument();
  });

  it('does not render the wireframe for the Unity platform', function () {
    const mockUnityProject = TestStubs.Project({platform: 'unity'});
    render(<ViewHierarchy viewHierarchy={MOCK_DATA} project={mockUnityProject} />);

    expect(screen.queryByTestId('view-hierarchy-wireframe')).not.toBeInTheDocument();
  });

  it('draws the selected node when a tree selection is made', function () {
    render(<ViewHierarchy viewHierarchy={MOCK_DATA} project={project} />);

    const canvas = screen.getByTestId(
      'view-hierarchy-wireframe-overlay'
    ) as HTMLCanvasElement;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context is not defined');
    }

    expect(context.fillRect).not.toHaveBeenCalledWith(210, 11, 3, 4);

    userEvent.click(screen.getByText('Nested Container - nested'));

    // This is the nested container, the x, y positions are shifted by the parent
    expect(context.fillRect).toHaveBeenCalledWith(210, 11, 3, 4);
  });

  it('does not render a wireframe selection initially', function () {
    render(<ViewHierarchy viewHierarchy={MOCK_DATA} project={project} />);

    const canvas = screen.getByTestId(
      'view-hierarchy-wireframe-overlay'
    ) as HTMLCanvasElement;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context is not defined');
    }

    // The overlay should not have rendered anything before any interactions
    expect(context.fillRect).not.toHaveBeenCalled();
  });

  it('renders an empty state if there is no data in windows to visualize', function () {
    render(
      <ViewHierarchy
        viewHierarchy={{rendering_system: 'This can be anything', windows: []}}
        project={project}
      />
    );

    expect(
      screen.getByText('There is no view hierarchy data to visualize')
    ).toBeInTheDocument();
  });

  it('renders with depth markers', function () {
    const {container} = render(
      <ViewHierarchy viewHierarchy={MOCK_DATA} project={project} />
    );

    expect(container).toSnapshot();
  });

  it('renders an icon with a tooltip for the rendering system', async function () {
    MOCK_DATA.rendering_system = 'flutter';
    render(<ViewHierarchy viewHierarchy={MOCK_DATA} project={project} />);

    userEvent.hover(screen.getByTestId('rendering-system-icon'));
    expect(await screen.findByText('Rendering System: flutter')).toBeInTheDocument();
  });
});
