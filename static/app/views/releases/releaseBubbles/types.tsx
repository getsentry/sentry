import type {MutableRefObject} from 'react';

import type {ReactEchartsRef} from 'sentry/types/echarts';
import type {ReleaseMetaBasic} from 'sentry/types/release';

export interface ChartRendererProps {
  /**
   * This needs to be passed as a `ref` to the chart being rendered. The chart
   * needs to forward the ref to ECharts component.
   */
  chartRef:
    | MutableRefObject<ReactEchartsRef | null>
    | ((e: ReactEchartsRef | null) => void);
  /**
   * The ending Date object of the release group to render
   */
  end: Date;
  /**
   * The list of releases in the current release group to render
   */
  releases: ReleaseMetaBasic[];
  /**
   * The starting Date object of the release group to render
   */
  start: Date;
}

export interface Bucket {
  end: number;
  releases: ReleaseMetaBasic[];
  start: number;
  // This is only set on the last bucket item and represents latest timestamp
  // for data whereas `end` represents the point on a chart's x-axis (time).
  // e.g. the max timestamp we show on the x-axis is 3:30, but data at that
  // point represents data from [3:30, now (final)]
  final?: number;
}
