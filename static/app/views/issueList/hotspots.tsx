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
  const DELIMITER = '/';
  const seriesData = [
    {
      id: '<root>',
      depth: 0,
      index: 0,
    },
    {
      id: '<root>/billiard',
      depth: 1,
      index: 1,
    },
    {
      id: '<root>/billiard/pool.py',
      errorCount: 3,
      depth: 2,
      index: 2,
    },
    {
      id: '<root>/getsentry',
      depth: 1,
      index: 3,
    },
    {
      id: '<root>/getsentry/utils',
      depth: 2,
      index: 4,
    },
    {
      id: '<root>/getsentry/utils/flagr.py',
      errorCount: 10,
      depth: 3,
      index: 5,
    },
    {
      id: '<root>/sentry',
      depth: 1,
      index: 6,
    },
    {
      id: '<root>/sentry/api',
      depth: 2,
      index: 7,
    },
    {
      id: '<root>/sentry/api/client.py',
      errorCount: 13,
      depth: 3,
      index: 8,
    },
    {
      id: '<root>/sentry/api/endpoints',
      depth: 3,
      index: 10,
    },
    {
      id: '<root>/sentry/api/endpoints/release_deploys.py',
      errorCount: 123,
      depth: 4,
      index: 11,
    },
    {
      id: '<root>/sentry/api/fields',
      depth: 3,
      index: 12,
    },
    {
      id: '<root>/sentry/api/fields/avatar.py',
      errorCount: 123,
      depth: 3,
      index: 13,
    },
    {
      id: '<root>/sentry/db',
      depth: 1,
      index: 14,
    },
    {
      id: '<root>/sentry/db/models',
      depth: 2,
      index: 15,
    },
    {
      id: '<root>/sentry/db/models/fields',
      depth: 3,
      index: 16,
    },
    {
      id: '<root>/sentry/db/models/fields/bounded.py',
      errorCount: 123,
      depth: 4,
      index: 17,
    },
    {
      id: '<root>/sentry/identity',
      depth: 2,
      index: 17,
    },
    {
      id: '<root>/sentry/identity/oauth2.py',
      errorCount: 123,
      depth: 2,
      index: 18,
    },
    {
      id: '<root>/sentry/interfaces',
      depth: 2,
      index: 19,
    },
    {
      id: '<root>/sentry/interfaces/contexts.py',
      errorCount: 123,
      depth: 2,
      index: 20,
    },
    {
      id: '<root>/sentry/models',
      depth: 2,
      index: 21,
    },
    {
      id: '<root>/sentry/models/organizationmember.py',
      errorCount: 123,
      depth: 2,
      index: 22,
    },
    {
      id: '<root>/sentry/models/releasefile.py',
      errorCount: 123,
      depth: 2,
      index: 23,
    },
    {
      id: '<root>/sentry/net',
      depth: 2,
      index: 24,
    },
    {
      id: '<root>/sentry/net/socket.py',
      errorCount: 123,
      depth: 2,
      index: 25,
    },
    {
      id: '<root>/sentry/receivers',
      depth: 2,
      index: 26,
    },
    {
      id: '<root>/sentry/receivers/releases.py',
      errorCount: 123,
      depth: 2,
      index: 27,
    },
    {
      id: '<root>/sentry/release_health',
      depth: 2,
      index: 28,
    },
    {
      id: '<root>/sentry/release_health/tasks.py',
      errorCount: 123,
      depth: 2,
      index: 29,
    },
    {
      id: '<root>/sentry/shared_integrations',
      depth: 2,
      index: 30,
    },
    {
      id: '<root>/sentry/shared_integrations/client',
      depth: 3,
      index: 31,
    },
    {
      id: '<root>/sentry/shared_integrations/client/base.py',
      errorCount: 123,
      depth: 3,
      index: 32,
    },
    {
      id: '<root>/sentry/utils',
      depth: 2,
      index: 33,
    },
    {
      id: '<root>/sentry/utils/json.py',
      errorCount: 123,
      depth: 2,
      index: 34,
    },
    {
      id: '<root>/sentry/utils/locking',
      depth: 3,
      index: 35,
    },
    {
      id: '<root>/sentry/utils/locking/lock.py',
      errorCount: 123,
      depth: 3,
      index: 36,
    },
    {
      id: '<root>/sentry/utils/monitors.py',
      errorCount: 123,
      depth: 2,
      index: 38,
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
        return d.id.substring(0, d.id.lastIndexOf(DELIMITER));
      })(seriesData)
      .sum(function (d) {
        return d.errorCount || 0;
      })
      .sort(function (a, b) {
        return b.errorCount - a.errorCount;
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
          .slice(nodePath.lastIndexOf(DELIMITER) + 1)
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
          tooltip: 'errorCount',
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
