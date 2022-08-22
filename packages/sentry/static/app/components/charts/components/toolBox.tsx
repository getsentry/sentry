import type {ToolboxComponentOption} from 'echarts';

function getFeatures({
  dataZoom,
  ...features
}: ToolboxComponentOption['feature'] = {}): ToolboxComponentOption['feature'] {
  return {
    ...(dataZoom
      ? {
          dataZoom: {
            yAxisIndex: 'none',
            title: {
              zoom: 'zoom',
              back: 'undo',
            },
            ...dataZoom,
          },
        }
      : {}),
    ...features,
  };
}

export default function ToolBox(
  options: ToolboxComponentOption,
  features: ToolboxComponentOption['feature']
): ToolboxComponentOption {
  return {
    right: 0,
    top: 0,
    itemSize: 16,
    // Stack the toolbox under the legend.
    // so all series names are clickable.
    z: -1,

    feature: getFeatures(features),
    ...options,
  };
}
