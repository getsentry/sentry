export type Finder =
  | string
  | {
      seriesIndex?: number;
      seriesId?: string;
      seriesName?: string;
      geoIndex?: number;
      geoId?: string;
      geoName?: string;
      xAxisIndex?: number;
      xAxisId?: string;
      xAxisName?: string;
      yAxisIndex?: number;
      yAxisId?: string;
      yAxisName?: string;
      gridIndex?: number;
      gridId?: string;
      gridName?: string;
    };
type PixelValue = Array<number | string> | number | string;

export type EchartsInstance = {
  group: string | number;
  setOption:
    | ((option: Object, notMerge?: boolean, lazyUpdate?: boolean) => void)
    | ((option: Object, opts?: Object) => void);
  getWidth: () => number;
  getHeight: () => number;
  getDom: () => HTMLCanvasElement | HTMLDivElement;
  getOption: () => Object;

  // See: https://echarts.apache.org/en/api.html#echartsInstance.resize
  // Unsure of return value
  resize: (opts?: {
    width?: number | string;
    height?: number | string;
    silent?: boolean;
  }) => void;

  dispatch: (payload: Object) => void;

  on:
    | ((eventName: string, handler: Function, context?: Object) => void)
    | ((
        eventName: string,
        query: string | Object,
        handler: Function,
        context?: Object
      ) => void);

  off: (eventName: string, handler?: Function) => void;

  convertToPixel: (
    // finder is used to indicate in which coordinate system conversion is performed.
    // Generally, index or id or name can be used to specify coordinate system.
    finder: Finder,
    // The value to be converted.
    value: PixelValue
  ) => // Conversion result, in pixel coordinate system, where the origin ([0, 0])
  // is on the left-top of the main dom of echarts instance.
  PixelValue;

  convertFromPixel: (
    // finder is used to indicate in which coordinate system conversion is performed.
    // Generally, index or id or name can be used to specify coordinate system.
    finder: Finder,
    // The value to be converted, in pixel coordinate system, where the origin ([0, 0])
    // is on the left-top of the main dom of echarts instance.
    value: PixelValue
  ) => // Conversion result
  PixelValue;

  containPixel: (
    // finder is used to specify coordinate systems or series on which the judgement performed.
    // Generally, index or id or name can be used to specify coordinate system.
    finder: Finder,
    // The value to be judged, in pixel coordinate system, where the origin ([0, 0])
    // is on the left-top of the main dom of echarts instance.
    value: PixelValue
  ) => boolean;

  showLoading: (type?: string, opts?: Object) => void;

  hideLoading: () => void;

  getDataURL: (opts: {
    // Exporting format, can be either png, or jpeg
    type?: string;
    // Resolution ratio of exporting image, 1 by default.
    pixelRatio?: number;
    // Background color of exporting image, use backgroundColor in option by default.
    backgroundColor?: string;
    // Excluded components list. e.g. ['toolbox']
    excludeComponents?: Array<string>;
  }) => string;

  getConnectedDataURL: (opts: {
    // Exporting format, can be either png, or jpeg
    type?: string;
    // Resolution ratio of exporting image, 1 by default.
    pixelRatio?: number;
    // Background color of exporting image, use backgroundColor in option by default.
    backgroundColor?: string;
    // Excluded components list. e.g. ['toolbox']
    excludeComponents?: Array<string>;
  }) => string;

  appendData: (opts: {
    // Specify which series the data will be appended to.
    seriesIndex?: string;
    // The data to be appended.
    data?: Array<any>;
  }) => string;

  clear: () => void;

  isDisposed: () => boolean;

  dispose: () => void;
};

export type ReactEchartsRef = {
  getEchartsInstance: () => EchartsInstance;
};
