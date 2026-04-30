import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SnapshotMainContent} from './snapshotMainContent';

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

describe('SnapshotMainContent', () => {
  it('keeps the diff/head toggle visible when viewing the head-only comparison', async () => {
    const onToggleSoloView = jest.fn();

    renderSnapshotMainContent({onToggleSoloView});

    expect(screen.getByText('Diff')).toBeInTheDocument();
    expect(screen.getByText('Head')).toBeInTheDocument();
    expect(screen.queryByText('Base')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Diff'));

    expect(onToggleSoloView).toHaveBeenCalledTimes(1);
  });
});
