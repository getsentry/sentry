export const CHART_ZOOM_MERGE_OPTIONS = {
  // Zooming only works when grouped by date.
  isGroupedByDate: true,
  // `notMerge` should always be `false`. i.e., ECharts should be
  // allowed to _merge_ the incoming options when they change. Note
  // `replaceMerge` below which ensures that the critical components
  // like the series and the axes are merged using the "replace"
  // algorithm, not the "normal" algorithm.
  //
  // Under `notMerge`, every data refresh does a full ECharts re-init that
  // destroys and re-creates the toolbox dataZoom "select" component. In
  // ECharts 6.1 that rebuild re-emits a stale `dataZoom` event, so a
  // single drag-to-zoom cascades into repeated refetches that settle on
  // the wrong time range. See apache/echarts#21661.
  //
  // To guard against this, we allow ECharts to preserve the
  // configuration of the toolbox, which prevents these stale fires.
  notMerge: false,
  replaceMerge: ['series', 'xAxis', 'yAxis'],
};
