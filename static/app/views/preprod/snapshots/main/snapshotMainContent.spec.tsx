import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {
  SnapshotDiffPair,
  SnapshotImage,
} from 'sentry/views/preprod/types/snapshotTypes';

import {SnapshotMainContent} from './snapshotMainContent';

const mockCopy = jest.fn();

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

jest.mock('./imageDisplay/useBufferedImageUrl', () => ({
  useBufferedImageGroup: (targetUrls: Array<string | null>) => targetUrls,
  useBufferedImageUrl: (targetUrl: string) => targetUrl,
}));

jest.mock('sentry/utils/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({copy: mockCopy}),
}));

function renderSnapshotMainContent(
  props: Partial<React.ComponentProps<typeof SnapshotMainContent>> = {}
) {
  const defaultProps: React.ComponentProps<typeof SnapshotMainContent> = {
    canNavigateNext: false,
    canNavigatePrev: false,
    comparisonType: 'solo',
    diffImageBaseUrl: '/api/0/projects/org-slug/project-slug/files/images/',
    diffMode: 'split',
    hasDiffComparison: true,
    imageBaseUrl: '/api/0/projects/org-slug/project-slug/files/images/',
    isSoloView: true,
    listItems: [],
    navButtonRefs: {next: {current: null}, prev: {current: null}},
    onDiffModeChange: jest.fn(),
    onNavigateSingleView: jest.fn(),
    onOverlayColorChange: jest.fn(),
    onToggleSoloView: jest.fn(),
    onViewModeChange: jest.fn(),
    overlayColor: 'transparent',
    selectedItem: null,
    variantIndex: 0,
    viewMode: 'list',
  };

  return render(<SnapshotMainContent {...defaultProps} {...props} />);
}

function image(overrides: Partial<SnapshotImage> = {}): SnapshotImage {
  return {
    content_hash: 'synthetic-content-hash',
    display_name: 'Button / light',
    height: 180,
    image_file_name: 'button.light.png',
    key: 'head-button-light',
    width: 320,
    ...overrides,
  };
}

const baseImage = image({
  content_hash: 'base-content-hash',
  display_name: 'Button / light base',
  image_file_name: 'button.light.base.png',
  key: 'base-button-light',
});

const headImage = image({
  content_hash: 'head-content-hash',
  group: 'components',
  key: 'head-button-light',
});

const changedPair: SnapshotDiffPair = {
  base_image: baseImage,
  diff: 0.042,
  diff_image_key: 'diff-button-light',
  head_image: headImage,
};

const renamedPair: SnapshotDiffPair = {
  base_image: image({
    content_hash: 'base-renamed-content-hash',
    display_name: 'Button / light old',
    image_file_name: 'button.light.old.png',
    key: 'base-button-light-old',
  }),
  diff: null,
  diff_image_key: null,
  head_image: image({
    content_hash: 'head-renamed-content-hash',
    group: 'components',
    image_file_name: 'button.light.png',
    key: 'head-button-light',
  }),
};

describe('SnapshotMainContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the diff/head toggle visible when viewing the head-only comparison', async () => {
    const onToggleSoloView = jest.fn();

    renderSnapshotMainContent({onToggleSoloView});

    expect(screen.getByText('Diff')).toBeInTheDocument();
    expect(screen.getByText('Head')).toBeInTheDocument();
    expect(screen.queryByText('Base')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Diff'));

    expect(onToggleSoloView).toHaveBeenCalledTimes(1);
  });

  it('renders focused changed snapshots with diff controls and navigation state', async () => {
    const onNavigateSingleView = jest.fn();

    renderSnapshotMainContent({
      canNavigateNext: true,
      canNavigatePrev: false,
      comparisonType: 'diff',
      headBranch: 'feature/snapshot-updates',
      isSoloView: false,
      listItems: [
        {
          key: 'changed-buttons',
          name: 'Buttons',
          displayName: 'Buttons',
          pairs: [changedPair],
          type: 'changed',
        },
      ],
      onNavigateSingleView,
      selectedItem: {
        key: 'changed-buttons',
        name: 'Buttons',
        displayName: 'Buttons',
        pairs: [changedPair],
        type: 'changed',
      },
      viewMode: 'single',
    });

    expect(screen.getByText('Buttons')).toBeInTheDocument();
    expect(screen.getByText('Button / light')).toBeInTheDocument();
    expect(screen.getByText(/Changed/)).toBeInTheDocument();
    expect(screen.getByText('feature/snapshot-updates')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Pick overlay color'})).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Split'})).toBeChecked();
    expect(screen.getByRole('radio', {name: 'Wipe'})).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Onion'})).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Previous snapshot'})).toBeDisabled();
    const nextButton = screen.getByRole('button', {name: 'Next snapshot'});
    expect(nextButton).toBeEnabled();

    await userEvent.click(nextButton);

    expect(onNavigateSingleView).toHaveBeenCalledWith('next');
  });

  it('renders focused renamed snapshots as a single image with pair metadata', async () => {
    renderSnapshotMainContent({
      comparisonType: 'diff',
      isSoloView: false,
      selectedItem: {
        key: 'renamed-buttons',
        name: 'Buttons',
        displayName: 'Buttons',
        pairs: [renamedPair],
        type: 'renamed',
      },
      viewMode: 'single',
    });

    expect(screen.getByText('Buttons')).toBeInTheDocument();
    expect(screen.getByText('Renamed')).toBeInTheDocument();
    expect(screen.getByRole('img', {name: 'Button / light'})).toBeInTheDocument();
    expect(screen.queryByText('Base')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Copy metadata as JSON'}));

    const copiedJson = mockCopy.mock.calls.at(-1)?.[0];
    expect(JSON.parse(copiedJson)).toEqual({
      base_image: {
        display_name: 'Button / light old',
        height: 180,
        image_file_name: 'button.light.old.png',
        width: 320,
      },
      diff: null,
      head_image: {
        display_name: 'Button / light',
        group: 'components',
        height: 180,
        image_file_name: 'button.light.png',
        width: 320,
      },
    });
  });
});
