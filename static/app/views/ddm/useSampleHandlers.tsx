import {useCallback} from 'react';
import debounce from 'lodash/debounce';

import {Sample} from 'sentry/views/ddm/widget';

type UseSampleHandlersProps = {
  numOfTimeseries: number;
  onClick?: (sample: Sample) => void;
  onMouseOut?: (sample?: Sample) => void;
  onMouseOver?: (sample: Sample) => void;
  sampleSeries?: any[];
};

export function useSampleHandlers({
  sampleSeries = [],
  numOfTimeseries,
  onMouseOver,
  onMouseOut,
  onClick,
}: UseSampleHandlersProps) {
  const getSample = useCallback(
    ({seriesIndex}) => {
      const isSpanSample = seriesIndex >= numOfTimeseries;
      const sampleSeriesIndex = seriesIndex - numOfTimeseries;
      if (isSpanSample) {
        return sampleSeries?.[sampleSeriesIndex] as Sample;
      }
      return undefined;
    },
    [sampleSeries, numOfTimeseries]
  );

  const handleSampleMouseOver = useCallback(
    event => {
      if (!onMouseOver) {
        return;
      }
      const sample = getSample(event);
      if (!sample) {
        return;
      }
      const debouncedMouseOver = debounce(onMouseOver, 1);
      debouncedMouseOver(sample);
    },
    [getSample, onMouseOver]
  );

  const handleSampleMouseOut = useCallback(
    event => {
      if (!onMouseOut) {
        return;
      }
      const sample = getSample(event);
      if (!sample) {
        return;
      }
      onMouseOut(sample);
      const debouncedMouseOut = debounce(onMouseOut, 1);
      debouncedMouseOut(sample);
    },
    [getSample, onMouseOut]
  );

  const handleSampleClick = useCallback(
    event => {
      if (!onClick) {
        return;
      }
      const sample = getSample(event);
      if (!sample) {
        return;
      }
      onClick(sample);
    },
    [getSample, onClick]
  );

  const handleSampleHighlight = useCallback(
    event => {
      // if (!onMouseOver || !onMouseOut) {
      //   return;
      // }
      // // if (isSpanSample && onMouseOverSample) {
      // //   const spanSampleData = sampledSpanDataSeries?.[seriesIndex - 2]?.data[0];
      // //   const {name: timestamp, value: duration} = spanSampleData;
      // //   const sample = getSample(timestamp as string, duration);
      // //   if (sample) {
      // //     onMouseOverSample(sample);
      // //   }
      // // }
      // // if (!isSpanSample && onMouseLeaveSample) {
      // //   onMouseLeaveSample();
      // // }
      // const sample = getSample({seriesIndex: 2});
      // if (!sample) {
      //   // const debouncedMouseOut = debounce(onMouseOut, 100);
      //   // debouncedMouseOut(sample);
      //   onMouseOut(sample);
      // } else {
      //   // const debouncedMouseOver = debounce(onMouseOver, 100);
      //   // debouncedMouseOver(sample);
      //   onMouseOver(sample);
      // }
      // if (!event.batch) {
      //   return;
      // }
      // const {seriesIndex} = event.batch[0];
      // const isSpanSample = seriesIndex >= numOfTimeseries;
      // if (isSpanSample && onMouseOver) {
      //   const sampleSeriesIndex = seriesIndex - numOfTimeseries;
      //   const spanSampleData = sampleSeries[sampleSeriesIndex];
      //   // const {name: timestamp, value: duration} = spanSampleData;
      //   // const sample = getSample(timestamp as string, duration);
      //   if (spanSampleData) {
      //     onMouseOver(spanSampleData);
      //   }
      // }
      // if (!isSpanSample && onMouseOut) {
      //   onMouseOut();
      // }
    },
    [numOfTimeseries, sampleSeries, onMouseOver, onMouseOut]
  );

  return {
    handleSampleMouseOver,
    handleSampleMouseOut,
    handleSampleClick,
    handleSampleHighlight,
  };
}
