import React, {useEffect, useState} from 'react';
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
import type {Project} from 'sentry/types';

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

type Props = {
  organizationSlug: string;
  projects: Project[];
};

function IssueHotSpots({organizationSlug, projects}: Props) {
  const DELIMITER = '/';

  const [isLoading, setIsLoading] = useState(true);
  const [diagramData, setDiagramData] = useState();

  const projectId = projects[0].id;

  let maxDepth = 1;
  let maxErrorCount = 1;
  let maxUniqueErrorCount = 1;

  useEffect(() => {
    const hotspotsEndpoint = `/api/0/organizations/${organizationSlug}/issues-hotspots/?project=${projectId}&statsPeriod=90d&noPagination=true&field=stack.filename&field=stack.filename&field=count()&field=count_unique(issue)`;
    fetch(hotspotsEndpoint, {
      credentials: 'include',
      headers: {
        Accept: 'application/json; charset=utf-8',
        'Accept-Language': 'en-US,en;q=0.5',
        'content-type': 'application/json',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
      },
      method: 'GET',
      mode: 'cors',
    })
      .then(result => result.json())
      .then(result => {
        for (const i in result) {
          const item = result[i];
          if ('depth' in item) {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            maxDepth = Math.max(maxDepth, +item.depth);
          }
          if ('errorCount' in item) {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            maxErrorCount = Math.max(maxErrorCount, +item.errorCount);
          }

          if ('uniqueErrorCount' in item) {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            maxUniqueErrorCount = Math.max(maxUniqueErrorCount, +item.uniqueErrorCount);
          }
        }
        setDiagramData(result);
        setIsLoading(false);
      });
  }, [organizationSlug, projectId]);

  if (isLoading) {
    return null;
  }

  function stratify() {
    const stratify_output = d3
      .stratify()
      .parentId(function (d) {
        return d.id.substring(0, d.id.lastIndexOf(DELIMITER));
      })(diagramData)
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

    const z2 = api.value('depth') * 2;

    const itemData = params.context.nodes[api.value(0)].data;
    const colors = [
      '#af87b4',
      '#a376a9',
      '#98659e',
      '#8d5494',
      '#7e4b85',
      '#704376',
      '#623a67',
    ];
    const colorIndex =
      Math.floor((colors.length / maxUniqueErrorCount) * itemData.uniqueErrorCount) - 1;

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
          text: nodeName,
          fontFamily: "'Rubik', 'Avenir Next', 'Helvetica Neue', sans-serif",
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
        fill: isLeaf ? colors[colorIndex] : api.visual('color'),
      },
      emphasis: {
        style: {
          fontFamily: "'Rubik', 'Avenir Next', 'Helvetica Neue', sans-serif",
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

  let displayRoot = stratify();

  const option = {
    dataset: {
      source: diagramData,
    },
    tooltip: {},
    visualMap: [
      {
        show: false,
        min: 0,
        max: maxDepth,
        dimension: 'depth',
        inRange: {
          color: ['#ffe0cf', '#fff7f3'], // Light Flame shades
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
        tooltip: {
          formatter: params => {
            const path = params.data.id.replace('<project_root>', '');
            if (!path) {
              return;
            }
            let output = `<b>Path:</b> <pre class="plain">${path}</pre>`;

            if (params.data.errorCount) {
              output += `<b>Total Errors:</b> ${params.data.errorCount}<br/>`;
            }

            if (params.data.uniqueErrorCount) {
              output += `<b>Distinct Errors:</b> ${params.data.uniqueErrorCount}`;
            }

            // eslint-disable-next-line consistent-return
            return output;
          },
        },
      },
    ],
  };

  let echartRef;

  const onEvents = {
    click: function (params) {
      drillDown(params.data.id);
    },
  };

  const resetEventInstalled = false;

  function drillDown(targetNodeId) {
    displayRoot = stratify();
    if (targetNodeId !== null && targetNodeId !== undefined) {
      displayRoot = displayRoot.descendants().find(function (node) {
        return node.data.id === targetNodeId;
      });
    }
    // A trick to prevent d3-hierarchy from visiting parents in this algorithm.
    displayRoot.parent = null;

    const echartInstance = echartRef.getEchartsInstance();
    echartInstance.setOption({
      dataset: {
        source: diagramData,
      },
    });

    // On the first click the reset click handler is installed.
    // (When clicking outside the view is resetted.)
    if (!resetEventInstalled) {
      echartInstance.getZr().on('click', function (event) {
        if (!event.target) {
          drillDown();
        }
      });
    }
  }

  return (
    <Layout.HotSpots noActionWrap>
      <ReactEChartsCore
        ref={e => {
          echartRef = e;
        }}
        echarts={echarts}
        option={option}
        onEvents={onEvents}
      />
    </Layout.HotSpots>
  );
}

export default IssueHotSpots;
