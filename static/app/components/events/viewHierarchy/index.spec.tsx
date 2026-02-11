import {EventFixture} from 'sentry-fixture/event';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {
  getPlatform,
  getPlatformViewConfig,
} from 'sentry/components/events/viewHierarchy/utils';
import type {Project} from 'sentry/types/project';

import type {ViewHierarchyData} from './index';
import {ViewHierarchy} from './index';

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

function getMockData(project?: Project) {
  const platform = getPlatform({
    event: EventFixture(),
    project: project ?? ProjectFixture(),
  });
  const platformViewConfig = getPlatformViewConfig(platform);
  return {
    platform,
    ...platformViewConfig,
  };
}

describe('View Hierarchy', () => {
  it('can continue make selections for inspecting data', async () => {
    const mockData = getMockData();
    render(
      <ViewHierarchy
        viewHierarchy={DEFAULT_MOCK_DATA}
        emptyMessage={mockData.emptyMessage}
        nodeField={mockData.nodeField}
        showWireframe={mockData.showWireframe}
        platform={mockData.platform}
      />
    );

    // 1 for the tree node, 1 for the details panel header
    expect(screen.getAllByText('Container - test_identifier')).toHaveLength(2);

    await userEvent.click(screen.getByText('Nested Container - nested'));

    // 1 for the tree node, 1 for the details panel header
    expect(screen.getAllByText('Nested Container - nested')).toHaveLength(2);
    // Only visible in the tree node
    expect(screen.getByText('Container - test_identifier')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Text'));

    // 1 for the tree node, 1 for the details panel header, 1 for the details value
    expect(screen.getAllByText('Text')).toHaveLength(3);
    // Only visible in the tree node
    expect(screen.getByText('Nested Container - nested')).toBeInTheDocument();
  });

  it('can expand and collapse by clicking the icon', async () => {
    const mockData = getMockData();
    render(
      <ViewHierarchy
        viewHierarchy={DEFAULT_MOCK_DATA}
        emptyMessage={mockData.emptyMessage}
        nodeField={mockData.nodeField}
        showWireframe={mockData.showWireframe}
        platform={mockData.platform}
      />
    );

    expect(screen.getByText('Text')).toBeInTheDocument();

    await userEvent.click(
      within(screen.getByLabelText('Nested Container - nested')).getByRole('button', {
        name: 'Collapse',
      })
    );

    expect(screen.queryByText('Text')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Expand'}));

    expect(screen.getByText('Text')).toBeInTheDocument();
  });

  it('can navigate with keyboard shortcuts after a selection', async () => {
    const mockData = getMockData();
    render(
      <ViewHierarchy
        viewHierarchy={DEFAULT_MOCK_DATA}
        emptyMessage={mockData.emptyMessage}
        nodeField={mockData.nodeField}
        showWireframe={mockData.showWireframe}
        platform={mockData.platform}
      />
    );

    await userEvent.click(screen.getAllByText('Container - test_identifier')[0]!);

    await userEvent.keyboard('{ArrowDown}');

    // 1 for the tree node, 1 for the details panel header
    expect(screen.getAllByText('Nested Container - nested')).toHaveLength(2);
  });

  it('can expand/collapse with the keyboard', async () => {
    const mockData = getMockData();
    render(
      <ViewHierarchy
        viewHierarchy={DEFAULT_MOCK_DATA}
        emptyMessage={mockData.emptyMessage}
        nodeField={mockData.nodeField}
        showWireframe={mockData.showWireframe}
        platform={mockData.platform}
      />
    );
    await userEvent.click(screen.getAllByText('Nested Container - nested')[0]!);

    await userEvent.keyboard('{Enter}');

    expect(screen.queryByText('Text')).not.toBeInTheDocument();

    await userEvent.keyboard('{Enter}');

    expect(screen.getByText('Text')).toBeInTheDocument();
  });

  it('can render multiple windows together', () => {
    const mockData = getMockData();
    render(
      <ViewHierarchy
        viewHierarchy={{
          ...DEFAULT_MOCK_DATA,
          windows: [
            ...DEFAULT_MOCK_DATA.windows,
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
          ],
        }}
        emptyMessage={mockData.emptyMessage}
        nodeField={mockData.nodeField}
        showWireframe={mockData.showWireframe}
        platform={mockData.platform}
      />
    );

    expect(screen.getByText('Second Window')).toBeInTheDocument();
    expect(screen.getByText('Second Window Child')).toBeInTheDocument();
  });

  it('does not render the wireframe for the Unity platform', () => {
    const mockData = getMockData(ProjectFixture({platform: 'unity'}));
    render(
      <ViewHierarchy
        viewHierarchy={DEFAULT_MOCK_DATA}
        emptyMessage={mockData.emptyMessage}
        nodeField={mockData.nodeField}
        showWireframe={mockData.showWireframe}
        platform={mockData.platform}
      />
    );

    expect(screen.queryByTestId('view-hierarchy-wireframe')).not.toBeInTheDocument();
  });

  it('draws the selected node when a tree selection is made', async () => {
    const mockData = getMockData();
    render(
      <ViewHierarchy
        viewHierarchy={DEFAULT_MOCK_DATA}
        emptyMessage={mockData.emptyMessage}
        nodeField={mockData.nodeField}
        showWireframe={mockData.showWireframe}
        platform={mockData.platform}
      />
    );

    const canvas = screen.getByTestId<HTMLCanvasElement>(
      'view-hierarchy-wireframe-overlay'
    );

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context is not defined');
    }

    expect(context.fillRect).not.toHaveBeenCalledWith(210, 11, 3, 4);

    await userEvent.click(screen.getByText('Nested Container - nested'));

    // This is the nested container, the x, y positions are shifted by the parent
    expect(context.fillRect).toHaveBeenCalledWith(210, 11, 3, 4);
  });

  it('does not render a wireframe selection initially', () => {
    const mockData = getMockData();
    render(
      <ViewHierarchy
        viewHierarchy={DEFAULT_MOCK_DATA}
        emptyMessage={mockData.emptyMessage}
        nodeField={mockData.nodeField}
        showWireframe={mockData.showWireframe}
        platform={mockData.platform}
      />
    );

    const canvas = screen.getByTestId<HTMLCanvasElement>(
      'view-hierarchy-wireframe-overlay'
    );

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context is not defined');
    }

    // The overlay should not have rendered anything before any interactions
    expect(context.fillRect).not.toHaveBeenCalled();
  });

  it('renders an empty state if there is no data in windows to visualize', () => {
    const mockData = getMockData();
    render(
      <ViewHierarchy
        viewHierarchy={{rendering_system: 'This can be anything', windows: []}}
        emptyMessage={mockData.emptyMessage}
        nodeField={mockData.nodeField}
        showWireframe={mockData.showWireframe}
        platform={mockData.platform}
      />
    );

    expect(
      screen.getByText('There is no view hierarchy data to visualize')
    ).toBeInTheDocument();
  });

  it('renders with depth markers', () => {
    const mockData = getMockData();
    render(
      <ViewHierarchy
        viewHierarchy={DEFAULT_MOCK_DATA}
        emptyMessage={mockData.emptyMessage}
        nodeField={mockData.nodeField}
        showWireframe={mockData.showWireframe}
        platform={mockData.platform}
      />
    );
  });

  it('renders an icon with a tooltip for the rendering system', async () => {
    const mockData = getMockData();
    render(
      <ViewHierarchy
        viewHierarchy={{
          ...DEFAULT_MOCK_DATA,
          rendering_system: 'flutter',
        }}
        emptyMessage={mockData.emptyMessage}
        nodeField={mockData.nodeField}
        showWireframe={mockData.showWireframe}
        platform={mockData.platform}
      />
    );

    await userEvent.hover(screen.getByTestId('rendering-system-icon'));
    expect(await screen.findByText('Rendering System: flutter')).toBeInTheDocument();
  });

  it('renders a custom ui for godot platform', async () => {
    const mockData = getMockData(ProjectFixture({platform: 'godot'}));
    render(
      <ViewHierarchy
        viewHierarchy={
          {
            rendering_system: 'Godot',
            windows: [
              {
                name: 'root',
                class: 'Window',
                children: [
                  {
                    name: 'SentryConfigurationScript',
                    class: 'SentryConfiguration',
                    script: 'res://example_configuration.gd',
                    children: [
                      {
                        name: 'Header - Output',
                        class: 'Label',
                        children: [],
                      },
                    ],
                  },
                ],
              },
            ],
          } as unknown as ViewHierarchyData
        }
        emptyMessage={mockData.emptyMessage}
        nodeField={mockData.nodeField}
        showWireframe={mockData.showWireframe}
        platform={mockData.platform}
      />
    );

    expect(screen.queryByTestId('view-hierarchy-wireframe')).not.toBeInTheDocument();

    expect(screen.getAllByRole('button', {name: 'Collapse'})).toHaveLength(3);

    expect(screen.getByText('Header - Output')).toBeInTheDocument();

    const collapseButton = within(
      screen.getByLabelText('SentryConfigurationScript')
    ).getByRole('button', {name: 'Collapse'});

    await userEvent.click(collapseButton);

    await waitFor(() =>
      expect(screen.queryByText('Header - Output')).not.toBeInTheDocument()
    );
  });

  it('renders a custom empty message for godot platform', () => {
    const mockData = getMockData(ProjectFixture({platform: 'godot'}));
    render(
      <ViewHierarchy
        viewHierarchy={{rendering_system: 'This can be anything', windows: []}}
        emptyMessage={mockData.emptyMessage}
        nodeField={mockData.nodeField}
        showWireframe={mockData.showWireframe}
        platform={mockData.platform}
      />
    );

    expect(screen.getByText(/no scene tree data/)).toBeInTheDocument();
  });
});
