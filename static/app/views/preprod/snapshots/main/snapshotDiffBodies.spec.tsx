import {fireEvent, render, screen} from 'sentry-test/reactTestingLibrary';

import {mockElementSize} from 'sentry/utils/fixtures/virtualization';
import type {SnapshotImage} from 'sentry/views/preprod/types/snapshotTypes';

import {SplitPairBody} from './snapshotDiffBodies';

const mockZoom = {
  containerRef: {current: null},
  resetZoom: jest.fn(),
  transform: {x: 0, y: 0, k: 1},
  zoomBehaviorRef: {current: null},
  zoomIn: jest.fn(),
  zoomOut: jest.fn(),
};

const mockUseSyncedD3Zoom = jest.fn((_options?: unknown) => [mockZoom, mockZoom]);

jest.mock('./imageDisplay/useD3Zoom', () => ({
  useD3Zoom: () => mockZoom,
  useSyncedD3Zoom: (options: unknown) => mockUseSyncedD3Zoom(options),
}));

function image(overrides: Partial<SnapshotImage> = {}): SnapshotImage {
  return {
    display_name: 'S',
    height: 180,
    image_file_name: 'a.png',
    key: 'k',
    tags: null,
    width: 320,
    ...overrides,
  };
}

function renderBody() {
  return render(
    <SplitPairBody
      baseUrl="/base.png"
      headUrl="/head.png"
      baseImage={image({image_file_name: 'a.base.png', key: 'base'})}
      headImage={image({image_file_name: 'a.png', key: 'head'})}
      headLabel="Head"
      altPrefix="Login"
    />
  );
}

describe('SplitPairBody zoom deferral', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockElementSize({width: 900, height: 600});
  });

  it('attaches d3-zoom only after the card is interacted with', () => {
    const {container} = renderBody();

    // Zoom starts disabled so its d3 selection + listeners stay off the mount path.
    expect(mockUseSyncedD3Zoom).toHaveBeenLastCalledWith(
      expect.objectContaining({enabled: false})
    );

    // The root carries onPointerEnter; pointerenter does not bubble, so fire it
    // directly on the element that owns the handler.
    fireEvent.pointerEnter(container.firstChild as Element);

    expect(mockUseSyncedD3Zoom).toHaveBeenLastCalledWith(
      expect.objectContaining({enabled: true})
    );
  });

  it('also enables zoom when focus enters the card (keyboard users)', () => {
    renderBody();

    fireEvent.focus(screen.getByRole('button', {name: 'Zoom in'}));

    expect(mockUseSyncedD3Zoom).toHaveBeenLastCalledWith(
      expect.objectContaining({enabled: true})
    );
  });
});
