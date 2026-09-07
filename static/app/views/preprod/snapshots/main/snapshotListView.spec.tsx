import {fireEvent, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {mockElementSize} from 'sentry/utils/fixtures/virtualization';
import type {
  SidebarItem,
  SnapshotDiffPair,
  SnapshotImage,
} from 'sentry/views/preprod/types/snapshotTypes';

import {SnapshotListView} from './snapshotListView';

const mockZoom = {
  containerRef: {current: null},
  resetZoom: jest.fn(),
  transform: {x: 0, y: 0, k: 1},
  zoomIn: jest.fn(),
  zoomOut: jest.fn(),
};

jest.mock('./imageDisplay/useD3Zoom', () => ({
  useD3Zoom: () => mockZoom,
  useSyncedD3Zoom: () => [mockZoom, mockZoom],
}));

jest.mock('sentry/utils/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({copy: jest.fn()}),
}));

function image(overrides: Partial<SnapshotImage> = {}): SnapshotImage {
  return {
    display_name: 'Login screen',
    height: 180,
    image_file_name: 'login.png',
    key: 'head-login',
    tags: null,
    width: 320,
    ...overrides,
  };
}

const erroredPair: SnapshotDiffPair = {
  base_image: image({
    display_name: 'Login screen base',
    image_file_name: 'login.base.png',
    key: 'base-login',
  }),
  diff: null,
  diff_image_key: null,
  head_image: image(),
};

function renderListView(items: SidebarItem[], diffMode?: 'split' | 'wipe' | 'onion') {
  return render(
    <SnapshotListView
      items={items}
      imageBaseUrl="/api/0/projects/org-slug/project-slug/files/images/"
      diffMode={diffMode}
    />
  );
}

const erroredItem: SidebarItem = {
  key: 'errored:screens',
  name: 'Screens',
  displayName: 'Screens',
  pairs: [erroredPair],
  type: 'errored',
};

describe('SnapshotListView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockElementSize({width: 900, height: 600});
    // jsdom returns empty padding strings; parseFloat('') is NaN, which would
    // propagate into the virtualizer's height math. Force numeric padding.
    jest.spyOn(window, 'getComputedStyle').mockReturnValue({
      paddingLeft: '0px',
      paddingRight: '0px',
      getPropertyValue: () => '',
    } as unknown as CSSStyleDeclaration);
    HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  it('renders errored pairs as side-by-side cards with a failed badge', () => {
    renderListView([erroredItem]);

    expect(screen.getByText('Failed to compare')).toBeInTheDocument();
  });

  it('renders errored pairs side-by-side even when the diff mode is onion', () => {
    renderListView([erroredItem], 'onion');

    expect(screen.getByText('Failed to compare')).toBeInTheDocument();
    // Onion mode renders an opacity slider; side-by-side (split) does not.
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  function changedGroup(count: number): SidebarItem {
    return {
      key: 'changed:Screens',
      name: 'Screens',
      displayName: 'Screens',
      type: 'changed',
      pairs: Array.from({length: count}, (_, i) => ({
        base_image: image({image_file_name: `s${i}.base.png`, group: 'Screens'}),
        head_image: image({
          display_name: `Screen ${i}`,
          image_file_name: `s${i}.png`,
          group: 'Screens',
        }),
        diff: null,
        diff_image_key: null,
      })),
    };
  }

  it('renders every card in a large single group (per-card rows) plus one header', () => {
    renderListView([changedGroup(6)]);

    expect(screen.getAllByRole('heading', {name: 'Screens'})).toHaveLength(1);
    expect(screen.getByText('Screen 0')).toBeInTheDocument();
    expect(screen.getByText('Screen 5')).toBeInTheDocument();
  });

  it('frames the first row of a group as frame-top and the last card row as frame-bottom', () => {
    renderListView([changedGroup(2)]);

    expect(document.querySelectorAll('[data-frame-top]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-frame-bottom]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-last-in-group]')).toHaveLength(1);
  });

  it('renders no group header for ungrouped items', () => {
    renderListView([
      {
        key: 'added:solo',
        name: 'solo.png',
        displayName: 'solo.png',
        type: 'added',
        images: [image({group: undefined, image_file_name: 'solo.png'})],
      },
    ]);

    expect(screen.queryByRole('heading', {name: 'solo.png'})).not.toBeInTheDocument();
  });

  it('reports the visible item key to the sidebar even for ungrouped items', async () => {
    const onVisibleGroupChange = jest.fn();
    render(
      <SnapshotListView
        items={[
          {
            key: 'added:solo',
            name: 'solo.png',
            displayName: 'solo.png',
            type: 'added',
            images: [image({group: undefined, image_file_name: 'solo.png'})],
          },
        ]}
        imageBaseUrl="/api/0/projects/org-slug/project-slug/files/images/"
        onVisibleGroupChange={onVisibleGroupChange}
      />
    );

    await waitFor(() => expect(onVisibleGroupChange).toHaveBeenCalled());
    expect(onVisibleGroupChange).toHaveBeenLastCalledWith('added:solo');
  });

  it('arrow-down selects the next card via onSelectSnapshot', () => {
    const onSelectSnapshot = jest.fn();
    render(
      <SnapshotListView
        items={[changedGroup(3)]}
        imageBaseUrl="/api/0/projects/org-slug/project-slug/files/images/"
        selectedSnapshotKey="s0.png"
        onSelectSnapshot={onSelectSnapshot}
      />
    );

    fireEvent.keyDown(document.body, {key: 'ArrowDown'});
    expect(onSelectSnapshot).toHaveBeenCalledWith('s1.png');
  });
});
