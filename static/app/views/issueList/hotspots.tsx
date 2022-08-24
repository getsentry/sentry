import React, {useEffect} from 'react';
import * as d3 from 'd3-hierarchy';
import {CustomChart} from 'echarts/charts';
import {
  DatasetComponent,
  GridComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import {SVGRenderer} from 'echarts/renderers';
import ReactEChartsCore from 'echarts-for-react/lib/core';

import * as Layout from 'sentry/components/layouts/thirds';

// Register the required components
echarts.use([
  TitleComponent,
  TooltipComponent,
  DatasetComponent,
  GridComponent,
  VisualMapComponent,
  CustomChart,
  SVGRenderer,
]);

type Props = {};

function IssueHotSpots({}: Props) {
  const seriesData = [
    {
      id: 'option',
      depth: 0,
      index: 0,
    },
    {
      id: 'option.dataZoom',
      value: 6229,
      depth: 1,
      index: 1,
    },
    {
      id: 'option.legend',
      value: 9273,
      depth: 1,
      index: 2,
    },
    {
      id: 'option.legend.align',
      value: 942,
      depth: 2,
      index: 3,
    },
    {
      id: 'option.legend.right',
      value: 634,
      depth: 2,
      index: 4,
    },
    {
      id: 'option.legend.z',
      value: 567,
      depth: 2,
      index: 5,
    },
    {
      id: 'option.legend.orient',
      value: 1356,
      depth: 2,
      index: 6,
    },
    {
      id: 'option.legend.show',
      value: 1181,
      depth: 2,
      index: 7,
    },
    {
      id: 'option.legend.zlevel',
      value: 634,
      depth: 2,
      index: 8,
    },
    {
      id: 'option.legend.left',
      value: 1137,
      depth: 2,
      index: 9,
    },
    {
      id: 'option.legend.itemHeight',
      value: 455,
      depth: 2,
      index: 10,
    },
    {
      id: 'option.legend.bottom',
      value: 788,
      depth: 2,
      index: 11,
    },
    {
      id: 'option.legend.itemGap',
      value: 761,
      depth: 2,
      index: 12,
    },
    {
      id: 'option.legend.formatter',
      value: 935,
      depth: 2,
      index: 13,
    },
    {
      id: 'option.legend.selectedMode',
      value: 937,
      depth: 2,
      index: 14,
    },
    {
      id: 'option.legend.selected',
      value: 1038,
      depth: 2,
      index: 15,
    },
    {
      id: 'option.legend.shadowBlur',
      value: 199,
      depth: 2,
      index: 16,
    },
    {
      id: 'option.legend.shadowColor',
      value: 189,
      depth: 2,
      index: 17,
    },
    {
      id: 'option.legend.shadowOffsetX',
      value: 180,
      depth: 2,
      index: 18,
    },
    {
      id: 'option.legend.shadowOffsetY',
      value: 142,
      depth: 2,
      index: 19,
    },
    {
      id: 'option.legend.backgroundColor',
      value: 471,
      depth: 2,
      index: 20,
    },
    {
      id: 'option.legend.data',
      value: 1430,
      depth: 2,
      index: 21,
    },
    {
      id: 'option.legend.data.icon',
      value: 882,
      depth: 3,
      index: 22,
    },
    {
      id: 'option.legend.data.name',
      value: 660,
      depth: 3,
      index: 23,
    },
    {
      id: 'option.legend.data.textStyle',
      value: 798,
      depth: 3,
      index: 24,
    },
    {
      id: 'option.legend.top',
      value: 831,
      depth: 2,
      index: 25,
    },
    {
      id: 'option.legend.padding',
      value: 706,
      depth: 2,
      index: 26,
    },
    {
      id: 'option.legend.itemWidth',
      value: 603,
      depth: 2,
      index: 27,
    },
    {
      id: 'option.legend.textStyle',
      value: 849,
      depth: 2,
      index: 28,
    },
    {
      id: 'option.legend.textStyle.fontSize',
      value: 150,
      depth: 3,
      index: 29,
    },
    {
      id: 'option.legend.textStyle.color',
      value: 237,
      depth: 3,
      index: 30,
    },
    {
      id: 'option.legend.textStyle.fontStyle',
      value: 113,
      depth: 3,
      index: 31,
    },
    {
      id: 'option.legend.textStyle.fontWeight',
      value: 101,
      depth: 3,
      index: 32,
    },
    {
      id: 'option.legend.textStyle.fontFamily',
      value: 91,
      depth: 3,
      index: 33,
    },
    {
      id: 'option.legend.borderColor',
      value: 318,
      depth: 2,
      index: 34,
    },
    {
      id: 'option.legend.borderWidth',
      value: 233,
      depth: 2,
      index: 35,
    },
    {
      id: 'option.legend.height',
      value: 64,
      depth: 2,
      index: 36,
    },
    {
      id: 'option.legend.width',
      value: 83,
      depth: 2,
      index: 37,
    },
    {
      id: 'option.dataZoom-inside',
      value: 1250,
      depth: 1,
      index: 38,
    },
    {
      id: 'option.dataZoom-inside.yAxisIndex',
      value: 221,
      depth: 2,
      index: 39,
    },
    {
      id: 'option.dataZoom-inside.startValue',
      value: 264,
      depth: 2,
      index: 40,
    },
    {
      id: 'option.dataZoom-inside.endValue',
      value: 136,
      depth: 2,
      index: 41,
    },
    {
      id: 'option.dataZoom-inside.xAxisIndex',
      value: 388,
      depth: 2,
      index: 42,
    },
    {
      id: 'option.dataZoom-inside.angleAxisIndex',
      value: 161,
      depth: 2,
      index: 43,
    },
    {
      id: 'option.dataZoom-inside.filterMode',
      value: 288,
      depth: 2,
      index: 44,
    },
    {
      id: 'option.dataZoom-inside.type',
      value: 639,
      depth: 2,
      index: 45,
    },
    {
      id: 'option.dataZoom-inside.start',
      value: 449,
      depth: 2,
      index: 46,
    },
    {
      id: 'option.dataZoom-inside.orient',
      value: 210,
      depth: 2,
      index: 47,
    },
    {
      id: 'option.dataZoom-inside.radiusAxisIndex',
      value: 141,
      depth: 2,
      index: 48,
    },
    {
      id: 'option.dataZoom-inside.throttle',
      value: 171,
      depth: 2,
      index: 49,
    },
    {
      id: 'option.dataZoom-inside.end',
      value: 191,
      depth: 2,
      index: 50,
    },
    {
      id: 'option.dataZoom-inside.zoomLock',
      value: 168,
      depth: 2,
      index: 51,
    },
  ];

  useEffect(
    () => {
      return () => {
        // cleanup code
      };
    },
    [] // dependencies werte die ich in useEffect hook brauch (wenn sich das uendert dann wird effect hook ausgefuehr)
  );

  function stratify() {
    const stratify_output = d3
      .stratify()
      .parentId(function (d) {
        return d.id.substring(0, d.id.lastIndexOf('.'));
      })(seriesData)
      .sum(function (d) {
        return d.value || 0;
      })
      .sort(function (a, b) {
        return b.value - a.value;
      });
    return stratify_output;
  }

  function overallLayout(params, api) {
    const context = params.context;
    d3
      .pack()
      .size([api.getWidth() - 2, api.getHeight() - 2])
      .padding(3)(displayRoot);

    context.nodes = {};

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    displayRoot.descendants().forEach(function (node, index) {
      context.nodes[node.id] = node;
    });
  }

  function renderItem(params, api) {
    const context = params.context;
    // Only do that layout once in each time `setOption` called.
    if (!context.layout) {
      context.layout = true;
      overallLayout(params, api);
    }

    const nodePath = api.value('id');

    const node = context.nodes[nodePath];

    if (!node) {
      // Reder nothing.
      return;
    }
    const isLeaf = !node.children || !node.children.length;
    const focus = new Uint32Array(
      node.descendants().map(function (_node) {
        return _node.data.index;
      })
    );
    const nodeName = isLeaf
      ? nodePath
          .slice(nodePath.lastIndexOf('.') + 1)
          .split(/(?=[A-Z][^A-Z])/g)
          .join('\n')
      : '';
    const z2 = api.value(2) * 2;

    const output = {
      type: 'circle',
      focus,
      shape: {
        cx: node.x,
        cy: node.y,
        r: node.r,
      },
      transition: ['shape'],
      z2,
      textContent: {
        type: 'text',
        style: {
          // transition: isLeaf ? 'fontSize' : null,
          text: nodeName,
          fontFamily: 'Arial',
          width: node.r * 1.3,
          overflow: 'truncate',
          fontSize: node.r / 3,
        },
        emphasis: {
          style: {
            overflow: null,
            fontSize: Math.max(node.r / 3, 12),
          },
        },
      },
      textConfig: {
        position: 'inside',
      },
      style: {
        fill: api.visual('color'),
      },
      emphasis: {
        style: {
          fontFamily: 'Arial',
          fontSize: 12,
          shadowBlur: 20,
          shadowOffsetX: 3,
          shadowOffsetY: 5,
          shadowColor: 'rgba(0,0,0,0.3)',
        },
      },
    };

    // eslint-disable-next-line consistent-return
    return output;
  }

  const displayRoot = stratify();

  const maxDepth = 2;

  const option = {
    dataset: {
      source: seriesData,
    },
    tooltip: {},
    visualMap: [
      {
        show: false,
        min: 0,
        max: maxDepth,
        dimension: 'depth',
        inRange: {
          // color: ['#ad6caa', '#f6f0f6'], // Sentry Light Purple
          color: ['#ffb287', '#fff7f3'], // Sentry Light Flame
          // color: ['#afafb0', '#f7f7f7'], // Gray
        },
      },
    ],
    hoverLayerThreshold: Infinity,
    series: [
      {
        type: 'custom',
        renderItem,
        progressive: 0,
        coordinateSystem: 'none',
        encode: {
          tooltip: 'value',
          itemName: 'id',
        },
      },
    ],
  };

  return (
    <Layout.HotSpots noActionWrap>
      <ReactEChartsCore echarts={echarts} option={option} />
    </Layout.HotSpots>
  );
}

export default IssueHotSpots;
