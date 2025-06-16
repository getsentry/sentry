import 'echarts/lib/component/tooltip';
import 'echarts/lib/component/grid';
import 'echarts/lib/component/graphic';
import 'echarts/lib/component/toolbox';
import 'zrender/lib/svg/svg';

import {useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {SunburstSeriesOption} from 'echarts';
import * as echarts from 'echarts/core';
import ReactEchartsCore from 'echarts-for-react/lib/core';

import {getTooltipStyles} from 'sentry/components/charts/baseChart';
import {computeChartTooltip} from 'sentry/components/charts/components/tooltip';
import type {EChartClickHandler, EChartMouseOverHandler} from 'sentry/types/echarts';

function bfsFilter(root: ProcessedTreeCoverageSunburstData, maxDepth: number) {
  const editableTree = structuredClone(root);
  const queue = [editableTree];

  while (queue.length > 0) {
    const node = queue.shift();

    if (!node) {
      continue;
    }

    if (node.depth === maxDepth) {
      node.children = [];
      node.value = 1;
      continue;
    }

    node?.children?.forEach(child => {
      queue.push(child);
    });
  }

  return editableTree;
}

/**
 * The ideal data structure for the sunburst chart coming from the backend is
 * as follows:
 *
 * {
 *   name: string;
 *   fullPath: string;
 *   value: 1 | undefined - value should be only for file nodes, directory nodes should not have a value
 *   coverage: number - coverage should be for both file and directory nodes
 *   children: <recursive structure>[] | undefined - only dir nodes should have the children field;
 * }
 */
interface TreeCoverageSunburstData {
  children: TreeCoverageSunburstData[];
  coverage: number;
  fullPath: string;
  name: string;
  value?: number;
}

interface ProcessedTreeCoverageSunburstData extends TreeCoverageSunburstData {
  depth?: number;
  itemStyle?: SunburstSeriesOption['itemStyle'];
  type?: 'dir' | 'file';
}

interface TreeCoverageSunburstChartProps {
  data: TreeCoverageSunburstData;
  autoHeightResize?: boolean;
}

export function TreeCoverageSunburstChart({
  data,
  autoHeightResize = false,
}: TreeCoverageSunburstChartProps) {
  const theme = useTheme();

  const [rootNode] = useState(() => {
    // we want to copy this prop value as we're inline editing it's content
    const tree = structuredClone(data);
    const nodeMap = new Map<string, TreeCoverageSunburstData>();
    const edges = new Map<any, TreeCoverageSunburstData>();
    // Store node and its depth
    const queue: Array<[ProcessedTreeCoverageSunburstData, number]> = [[tree, 0]];

    while (queue.length > 0) {
      const queueEntry = queue.shift();
      if (!queueEntry) {
        continue;
      }

      const [node, currentDepth] = queueEntry;
      node.depth = currentDepth;
      nodeMap.set(node.fullPath, node);

      if (node.children) {
        node.type = 'dir';

        if (node.coverage < 60) {
          node.itemStyle = {color: theme.red300};
        } else if (node.coverage < 80) {
          node.itemStyle = {color: theme.yellow300};
        } else {
          node.itemStyle = {color: theme.green300};
        }

        node.children.forEach(child => {
          queue.push([child, currentDepth + 1]);
          edges.set(child.fullPath, node);
        });
      } else {
        node.type = 'file';

        if (node.coverage < 60) {
          node.itemStyle = {color: theme.red300, opacity: 0.6};
        } else if (node.coverage < 80) {
          node.itemStyle = {color: theme.yellow300, opacity: 0.6};
        } else {
          node.itemStyle = {color: theme.green300, opacity: 0.6};
        }
      }
    }

    return {tree, nodeMap, edges};
  });
  const [renderData, setRenderData] = useState(bfsFilter(rootNode.tree, 2));
  const [breadCrumbs, setBreadCrumbs] = useState(rootNode.tree.fullPath);

  return (
    <div>
      <ChartContainer autoHeightResize={autoHeightResize}>
        <ReactEchartsCore
          echarts={echarts}
          onEvents={{
            mouseover: (
              params: Parameters<
                EChartMouseOverHandler<ProcessedTreeCoverageSunburstData>
              >[0]
            ) => {
              const splitPaths = params.data.fullPath.split('/');

              if (splitPaths.length > 2) {
                setBreadCrumbs(`../${splitPaths.slice(-2).join('/')}`);
              } else {
                setBreadCrumbs(params.data.fullPath);
              }
            },
            click: (
              params: Parameters<EChartClickHandler<ProcessedTreeCoverageSunburstData>>[0]
            ) => {
              if (params?.data?.type === 'dir') {
                const parent = rootNode.edges.get(params.data.fullPath);
                const node = rootNode.nodeMap.get(params.data?.fullPath);
                if (!node) {
                  return;
                }

                setRenderData(() => {
                  if ((params.data.depth ?? 0) > 0 && parent) {
                    const children = bfsFilter(node, (params.data?.depth ?? 0) + 1);

                    return {
                      ...parent,
                      name: parent.name,
                      itemStyle: {color: theme.blue300, opacity: 0.9},
                      children: [children],
                    } satisfies ProcessedTreeCoverageSunburstData;
                  }

                  return bfsFilter(node, (params.data?.depth ?? 0) + 2);
                });
              }
            },
          }}
          option={{
            tooltip: computeChartTooltip(
              {
                formatter: (params: any) => {
                  return [
                    '<div class="tooltip-series">',
                    `<div>
                        <span class="tooltip-label">
                          <strong>${params.data.dir ? 'Directory' : 'File'}: </strong>${params.data.name}
                       </span>
                     </div>`,
                    `<div>
                        <span class="tooltip-label">
                          <strong>Coverage</strong>: ${params.data.coverage}%
                        </span>
                      </div>`,
                    '</div>',
                  ].join('');
                },
              },
              theme
            ),
            series: {
              animation: false,
              type: 'sunburst',
              data: [renderData],
              radius: [40, 100],
              label: {show: false},
              emphasis: {focus: 'ancestor'},
              nodeClick: false,
            },
          }}
        />
      </ChartContainer>
      <BreadCrumbContainer>{breadCrumbs}</BreadCrumbContainer>
    </div>
  );
}

const BreadCrumbContainer = styled('div')`
  display: flex;
  justify-content: flex-start;
`;

// Contains styling for chart elements as we can't easily style those
// elements directly
const ChartContainer = styled('div')<{autoHeightResize: boolean}>`
  ${p => p.autoHeightResize && 'height: 100%;'}

  .echarts-for-react div:first-of-type {
    width: 100% !important;
  }

  .echarts-for-react text {
    font-variant-numeric: tabular-nums !important;
  }

  ${p => getTooltipStyles(p)}
`;
