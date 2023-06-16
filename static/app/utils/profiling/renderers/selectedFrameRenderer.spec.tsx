import {mat3, vec2} from 'gl-matrix';

import {SelectedFrameRenderer} from 'sentry/utils/profiling/renderers/selectedFrameRenderer';
import {Rect} from 'sentry/utils/profiling/speedscope';

describe('SelectedFrameRenderer', () => {
  it('draws rect in center', () => {
    const context: Partial<CanvasRenderingContext2D> = {
      measureText: jest.fn().mockImplementation(n => {
        return {width: n.length};
      }),
      strokeStyle: undefined,
      lineWidth: undefined,
      beginPath: jest.fn(),
      fillText: jest.fn(),
      strokeRect: jest.fn(),
    };

    const canvas: Partial<HTMLCanvasElement> = {
      getContext: jest.fn().mockReturnValue(context),
    };

    const renderer = new SelectedFrameRenderer(canvas as HTMLCanvasElement);

    renderer.draw(
      [new Rect(0, 0, 100, 100)],
      {BORDER_COLOR: 'red', BORDER_WIDTH: 1},
      mat3.scale(mat3.create(), mat3.create(), vec2.fromValues(2, 2))
    );

    expect(context.beginPath).toHaveBeenCalled();
    expect(context.strokeStyle).toBe('red');
    expect(context.lineWidth).toBe(1);
    expect(context.strokeRect).toHaveBeenLastCalledWith(1, 1, 198, 198);
  });
});
