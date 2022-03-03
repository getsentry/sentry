import {mat3} from 'gl-matrix';

import {FlamegraphTheme} from '../flamegraph/flamegraphTheme';
import {getContext, Rect} from '../gl/utils';

class PositionIndicatorRenderer {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  theme: FlamegraphTheme;

  constructor(canvas: HTMLCanvasElement, theme: FlamegraphTheme) {
    this.canvas = canvas;
    this.theme = theme;

    this.context = getContext(this.canvas, '2d');
  }

  draw(configView: Rect, configSpace: Rect, configToPhysicalSpace: mat3): void {
    if (configView.equals(configSpace)) {
      // User is not zoomed in, so we dont need to draw anything.
      return;
    }

    // Transform both views to their respective physical spaces
    const physicalConfigViewRect =
      Rect.From(configView).transformRect(configToPhysicalSpace);
    const physicalConfigRect =
      Rect.From(configSpace).transformRect(configToPhysicalSpace);

    const offsetRectForBorderWidth: [number, number, number, number] = [
      physicalConfigViewRect.x - this.theme.SIZES.MINIMAP_POSITION_OVERLAY_BORDER_WIDTH,
      physicalConfigViewRect.y,
      physicalConfigViewRect.width +
        this.theme.SIZES.MINIMAP_POSITION_OVERLAY_BORDER_WIDTH,
      physicalConfigViewRect.height,
    ];

    // What we do to draw the "window" that the user is currently watching is we draw two rectangles, the
    // zoomed in view and the zoomed out view. The zoomed out view is the full view of the flamegraph, and the zoom
    // in view is whatever the user is currently looking at. Because the zoomed in view is a subset of the zoomed,
    // we just need to use the evenodd fill rule to paint inbetween the two rectangles.
    this.context.fillStyle = this.theme.COLORS.MINIMAP_POSITION_OVERLAY_COLOR;
    this.context.strokeStyle = this.theme.COLORS.MINIMAP_POSITION_OVERLAY_BORDER_COLOR;
    this.context.lineWidth = this.theme.SIZES.MINIMAP_POSITION_OVERLAY_BORDER_WIDTH;

    this.context.beginPath();
    this.context.rect(0, 0, physicalConfigRect.width, physicalConfigRect.height);
    this.context.rect(...offsetRectForBorderWidth);

    this.context.fill('evenodd');
    this.context.strokeRect(...offsetRectForBorderWidth);
  }
}

export {PositionIndicatorRenderer};
