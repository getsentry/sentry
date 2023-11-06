import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {type Theme, useTheme} from '@emotion/react';
import {mat3, vec3} from 'gl-matrix';

import {Series} from 'sentry/types/echarts';
import {
  getPhysicalWidthAndHeightFromObserverEntry,
  hexToColorChannels,
  onResizeCanvasToDisplaySize,
  transformMatrixBetweenRect,
  watchForResize,
} from 'sentry/utils/profiling/gl/utils';
import {Rect} from 'sentry/utils/profiling/speedscope';

function mutateRectInPlace(rect: Rect, {x, y, width, height}: Record<string, number>) {
  rect.origin[0] = x;
  rect.origin[1] = y;
  rect.size[0] = width;
  rect.size[1] = height;
}

type ResizeListener = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void;

function useResizeCanvas(canvas: HTMLCanvasElement | null, onResize: ResizeListener) {
  useLayoutEffect(() => {
    if (!canvas) {
      return undefined;
    }

    const observer = watchForResize([canvas], entries => {
      onResize(entries, observer);
    });

    return () => {
      observer.disconnect();
    };
  }, [canvas, onResize]);
}

const mutateSeriesConfigSpace = (series: Series, configSpace: Rect) => {
  if (!series?.data?.length) {
    return;
  }

  const widthMin = series.data[0].name as number;
  const widthMax = series.data[series.data.length - 1].name as number;

  let heightMax = 0;

  for (let i = 0; i < series.data.length; i++) {
    const point = series.data[i];
    if (point.value > heightMax) {
      heightMax = point.value;
    }
  }

  configSpace.size[0] = widthMax - widthMin;
  configSpace.size[1] = heightMax;
};

interface FastMiniBarChartProps {
  series: Series[];
}

class CanvasChartRenderer {
  series: number[][] = [];
  timestamps: number[][] = [];
  serieType: ('bar' | 'markline')[] = [];
  colors: string[] = [];

  ctx: CanvasRenderingContext2D | null;

  constructor(canvas: HTMLCanvasElement, series: Series[], theme: Theme) {
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) {
      throw new Error('Could not get canvas context');
    }

    const fallbackcolor = `rgba(${hexToColorChannels(theme.gray300, 0.6)
      .map((v, i) => (i < 3 ? v * 255 : v))
      .join(',')})`;

    for (let i = 0; i < series.length; i++) {
      const serie = series[i];
      if (!serie?.data?.length) {
        continue;
      }
      const values = new Array(serie.data.length);
      const timestamps = new Array(serie.data.length);

      let max = 0;

      for (let j = 0; j < serie.data.length; j++) {
        // Dont push as the array is preallocated, meaning
        // we would be appending after the allocated slots
        values[j] = serie.data[j].value as number;
        timestamps[j] = serie.data[j].name as number;

        if (values[j] > max) {
          max = values[j];
        }
      }

      this.series.push(values);
      this.timestamps.push(timestamps);
      this.colors.push(serie.color ?? fallbackcolor);
      this.serieType.push('bar');

      if (serie.markLine) {
        this.colors.push(serie.color ?? fallbackcolor);
        // @ts-ignore seems like a type issue
        if (serie.markLine?.data[0]?.type === 'max') {
          this.series.push([max]);
        } else {
          throw new Error('Markline type is not implemented');
        }
        this.serieType.push('markline');
        this.timestamps.push([]);
      }
    }
  }

  draw(configSpace: Rect, physicalSpace: Rect) {
    if (!configSpace.isValid() || !physicalSpace.isValid()) {
      return;
    }
    if (!this.ctx) {
      throw new Error('ctx is null');
    }

    this.ctx.clearRect(0, 0, physicalSpace.width, physicalSpace.height);
    const offsetPhysicalSpace = physicalSpace
      // shrink the chart height by the padding to pad the top of chart
      .withHeight(physicalSpace.height - 10);

    const configToPhysicalSpace = transformMatrixBetweenRect(
      configSpace,
      offsetPhysicalSpace
    );

    mat3.multiply(
      configToPhysicalSpace,
      [1, 0, 0, 0, -1, 0, 0, offsetPhysicalSpace.height, 1],
      configToPhysicalSpace
    );

    const physicalToConfigSpace = mat3.invert(mat3.create(), configToPhysicalSpace);
    const configSpacePixel = new Rect(0, 0, 1, 1).transformRect(physicalToConfigSpace);

    const MIN_BAR_HEIGHT = configSpacePixel.height * 2;
    const BAR_BORDER_PX = configSpacePixel.width * 2;

    for (let i = 0; i < this.series.length; i++) {
      const serie = this.series[i];
      if (!serie.length) {
        continue;
      }

      if (this.serieType[i] === 'markline') {
        this.ctx.lineWidth = 2 * window.devicePixelRatio;
        this.ctx.setLineDash([1 * window.devicePixelRatio, 2 * window.devicePixelRatio]);
        this.ctx.strokeStyle = this.colors[i];

        const marklineHeight = serie[0];
        const left = vec3.fromValues(0, marklineHeight, 1);
        vec3.transformMat3(left, left, configToPhysicalSpace);

        const right = vec3.fromValues(configSpace.width, marklineHeight, 1);
        vec3.transformMat3(right, right, configToPhysicalSpace);

        this.ctx.beginPath();
        this.ctx.moveTo(left[0], left[1]);
        this.ctx.lineTo(right[0], right[1]);
        this.ctx.stroke();
        continue;
      }

      if (this.serieType[i] === 'bar') {
        this.ctx.fillStyle = this.colors[i];
        const barWidth = configSpace.width / serie.length;

        for (let j = 0; j < serie.length; j++) {
          const value = serie[j];
          const timestamp = this.timestamps[i][j] - this.timestamps[i][0];

          const origin = vec3.fromValues(timestamp + BAR_BORDER_PX, 0, 1);

          const size = vec3.fromValues(
            barWidth - 2 * BAR_BORDER_PX,
            value < MIN_BAR_HEIGHT ? MIN_BAR_HEIGHT : value,
            1
          );

          vec3.transformMat3(origin, origin, configToPhysicalSpace);
          vec3.transformMat3(size, size, configToPhysicalSpace);

          this.ctx.fillRect(origin[0], size[1], size[0], physicalSpace.height);
        }
        continue;
      }

      throw new Error(`Serie type ${this.serieType[i]} is not implemented`);
    }
  }
}

export function FastMiniBarChart(props: FastMiniBarChartProps) {
  const configSpaceRef = useRef(Rect.Empty());
  const physicalSpaceRef = useRef(Rect.Empty());
  const theme = useTheme();

  const [canvasRef, setCanvasRef] = useState<HTMLCanvasElement | null>(null);
  const renderer = useRef<CanvasChartRenderer | null>(null);

  // This is sub optimal - renderer requires ctx and canvasRef which are initialized at different times.
  // setState is convenient as it eventually guarantees that the canvasRef is set, but it also means we are wasting
  // rerenders for no reason.
  useEffect(() => {
    if (!canvasRef) {
      return;
    }
    renderer.current = new CanvasChartRenderer(canvasRef, props.series, theme);
  }, [props.series, canvasRef, theme]);

  const onResize: ResizeListener = useCallback(
    (entries, observer) => {
      onResizeCanvasToDisplaySize(entries);

      const [width, height] = getPhysicalWidthAndHeightFromObserverEntry(entries[0]);
      mutateRectInPlace(physicalSpaceRef.current, {
        width,
        height,
        x: 0,
        y: 0,
      });
      // Find a better place for this so we dont have to iterate
      // over the entire series on each resize event
      mutateSeriesConfigSpace(props.series[0], configSpaceRef.current);

      if (renderer.current) {
        renderer.current.draw(configSpaceRef.current, physicalSpaceRef.current);
      }
    },
    [props.series]
  );

  useResizeCanvas(canvasRef, onResize);

  return <canvas ref={setCanvasRef} />;
}
