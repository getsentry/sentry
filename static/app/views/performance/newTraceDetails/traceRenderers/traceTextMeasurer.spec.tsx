import {ThemeFixture} from 'sentry-fixture/theme';

import {TraceTextMeasurer} from 'sentry/views/performance/newTraceDetails/traceRenderers/traceTextMeasurer';

const originalCreateElement = document.createElement;

describe('TraceTextMeasurer', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sets canvas font using theme size and family', () => {
    const theme = ThemeFixture();
    const context: Partial<CanvasRenderingContext2D> & {font: string} = {
      font: '',
      measureText: jest.fn().mockReturnValue({width: 10}),
    };

    const canvas: Partial<HTMLCanvasElement> = {
      width: 0,
      height: 0,
      getContext: jest.fn().mockReturnValue(context),
    };

    jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === 'canvas') {
        return canvas as HTMLCanvasElement;
      }

      return originalCreateElement.call(document, tagName);
    });

    // @ts-expect-error - we're assigning this so that we can call new without issue.
    const _measurer = new TraceTextMeasurer(theme);

    expect(context.font).toBe(`${theme.font.size.xs} ${theme.font.family.sans}`);
  });

  it('falls back to approximated duration widths without a canvas context', () => {
    const canvas: Partial<HTMLCanvasElement> = {
      getContext: jest.fn().mockReturnValue(null),
    };

    jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === 'canvas') {
        return canvas as HTMLCanvasElement;
      }

      return originalCreateElement.call(document, tagName);
    });

    const measurer = new TraceTextMeasurer(ThemeFixture());

    expect(measurer.duration.ms).toBe(2 * 6.5);
    expect(measurer.measure('10ms')).toBe(2 * 6.5);
  });
});
