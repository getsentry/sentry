import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {SnapshotImage} from 'sentry/views/preprod/types/snapshotTypes';

import {ImageCard} from './snapshotCards';

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

function renderImageCard(
  canvasTheme: SnapshotImage['canvas_theme'],
  onSelectSnapshot?: (key: string | null) => void
) {
  const image: SnapshotImage = {
    display_name: 'Button',
    height: 180,
    image_file_name: 'button.png',
    key: 'head-button',
    tags: null,
    width: 320,
    canvas_theme: canvasTheme,
  };
  render(
    <ImageCard
      cardType="solo"
      image={image}
      imageBaseUrl="/img/"
      isSelected={false}
      copyUrl="/copy/"
      snapshotKey={image.key}
      onSelectSnapshot={onSelectSnapshot}
    />
  );
}

// The header toggle is labeled with the action it performs: 'Light preview'
// means the canvas is dark, 'Dark preview' means it is light.
const expectDarkCanvas = () =>
  expect(screen.getByRole('button', {name: 'Light preview'})).toBeInTheDocument();
const expectLightCanvas = () =>
  expect(screen.getByRole('button', {name: 'Dark preview'})).toBeInTheDocument();

describe('ImageCard canvas theme', () => {
  it('seeds the canvas from an explicit canvas_theme hint', () => {
    renderImageCard('dark');
    expectDarkCanvas();
  });

  it('toggles the canvas independently of the hint', async () => {
    renderImageCard('dark');
    expectDarkCanvas();

    await userEvent.click(screen.getByRole('button', {name: 'Light preview'}));
    expectLightCanvas();
  });
});

describe('ImageCard zoom', () => {
  it('renders zoom controls wired to the image zoom', async () => {
    renderImageCard(null);

    await userEvent.click(screen.getByRole('button', {name: 'Zoom in'}));
    await userEvent.click(screen.getByRole('button', {name: 'Zoom out'}));
    await userEvent.click(screen.getByRole('button', {name: 'Reset zoom'}));

    expect(mockZoom.zoomIn).toHaveBeenCalledTimes(1);
    expect(mockZoom.zoomOut).toHaveBeenCalledTimes(1);
    expect(mockZoom.resetZoom).toHaveBeenCalledTimes(1);
  });

  it('hints at modifier scroll zoom on the zoom buttons', async () => {
    renderImageCard(null);

    await userEvent.hover(screen.getByRole('button', {name: 'Zoom in'}));

    expect(await screen.findByText('Scroll')).toBeInTheDocument();
  });

  it('does not toggle card selection when using zoom controls', async () => {
    const onSelectSnapshot = jest.fn();
    renderImageCard(null, onSelectSnapshot);

    await userEvent.click(screen.getByRole('button', {name: 'Zoom in'}));

    expect(onSelectSnapshot).not.toHaveBeenCalled();
  });
});
