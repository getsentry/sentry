import {mat3, vec2} from 'gl-matrix';

import {LightFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {Rect} from 'sentry/utils/profiling/gl/utils';
import {PositionIndicatorRenderer} from 'sentry/utils/profiling/renderers/positionIndicatorRenderer';

describe('PositionIndicatorRenderer', () => {
  it('draws nothing if view is not zoomed', () => {
    const configView = new Rect(0, 0, 100, 100);
    const configSpace = new Rect(0, 0, 100, 100);

    const context: Partial<CanvasRenderingContext2D> = {
      beginPath: jest.fn(),
      rect: jest.fn(),
      fill: jest.fn(),
      strokeRect: jest.fn(),
      fillStyle: undefined,
      strokeStyle: undefined,
      lineWidth: undefined,
    };

    const canvas: Partial<HTMLCanvasElement> = {
      getContext: jest.fn().mockReturnValue(context),
    };

    const renderer = new PositionIndicatorRenderer(
      canvas as HTMLCanvasElement,
      LightFlamegraphTheme
    );
    renderer.draw(configView, configSpace, mat3.identity(mat3.create()));

    expect(context.beginPath).not.toHaveBeenCalled();
  });

  it('draws if view is not zoomed', () => {
    const configView = new Rect(40, 40, 20, 100);
    const configSpace = new Rect(0, 0, 100, 100);

    const context: Partial<CanvasRenderingContext2D> = {
      beginPath: jest.fn(),
      rect: jest.fn(),
      fill: jest.fn(),
      strokeRect: jest.fn(),
      fillStyle: undefined,
      strokeStyle: undefined,
      lineWidth: undefined,
    };

    const canvas: Partial<HTMLCanvasElement> = {
      getContext: jest.fn().mockReturnValue(context),
    };

    const renderer = new PositionIndicatorRenderer(
      canvas as HTMLCanvasElement,
      LightFlamegraphTheme
    );
    renderer.draw(
      configView,
      configSpace,
      mat3.fromScaling(mat3.create(), vec2.fromValues(2, 2))
    );

    expect(context.beginPath).toHaveBeenCalled();
    // @ts-ignore this is a mock
    expect(context.rect.mock.calls[0]).toEqual([0, 0, 200, 200]);
    // @ts-ignore this is a mock
    // We offset x by width of the border be
    expect(context.rect.mock.calls[1]).toEqual([
      80 - LightFlamegraphTheme.SIZES.MINIMAP_POSITION_OVERLAY_BORDER_WIDTH,
      80,
      40 + LightFlamegraphTheme.SIZES.MINIMAP_POSITION_OVERLAY_BORDER_WIDTH,
      200,
    ]);
  });
});
