import {render, screen} from 'sentry-test/reactTestingLibrary';

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
    jest
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({paddingLeft: '0px', paddingRight: '0px'} as CSSStyleDeclaration);
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
});
