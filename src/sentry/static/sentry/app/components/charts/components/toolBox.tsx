import {EChartOption} from 'echarts';

function getFeatures({dataZoom, ...features}) {
  return {
    ...(dataZoom
      ? {
          dataZoom: {
            yAxisIndex: 'none',
            title: {
              zoom: 'zoom',
              back: 'undo',
              restore: 'reset',
            },
            ...dataZoom,
          },
        }
      : {}),
    ...features,
  };
}

export default function ToolBox(options, features): EChartOption['toolbox'] {
  return {
    right: 0,
    top: 0,
    itemSize: 16,

    feature: getFeatures(features),
    ...options,
  };
}
