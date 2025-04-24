import 'echarts/lib/component/tooltip';
import 'echarts/lib/component/grid';
import 'echarts/lib/component/graphic';
import 'echarts/lib/component/toolbox';
import 'zrender/lib/svg/svg';

import {useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {SunburstSeriesOption, TooltipComponentOption} from 'echarts';
import * as echarts from 'echarts/core';
import ReactEchartsCore from 'echarts-for-react/lib/core';

import {getTooltipStyles} from 'sentry/components/charts/baseChart';
import {CHART_TOOLTIP_VIEWPORT_OFFSET} from 'sentry/components/charts/components/tooltip';
import type {EChartClickHandler, EChartMouseOverHandler} from 'sentry/types/echarts';

function bfsFilter(root: ProcessedSunburstData, maxDepth: number) {
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

export interface SunburstData {
  children: SunburstData[];
  coverage: number;
  fullPath: string;
  name: string;
  value: number;
  dir?: boolean;
}

interface ProcessedSunburstData extends SunburstData {
  depth?: number;
  itemStyle?: SunburstSeriesOption['itemStyle'];
  type?: 'dir' | 'file';
}

interface SunburstChartProps {
  data: SunburstData;
}

export function SunburstChart({data}: SunburstChartProps) {
  const theme = useTheme();

  const [rootData] = useState(() => {
    // we want to copy this prop value as we're inline editing it's content
    const tree = structuredClone(data);
    const nodeMap = new Map<string, SunburstData>();
    const edges = new Map<any, SunburstData>();
    // Store node and its depth
    const queue: Array<[ProcessedSunburstData, number]> = [[tree, 0]];

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
  const [renderData, setRenderData] = useState(bfsFilter(rootData.tree, 2));
  const [breadCrumbs, setBreadCrumbs] = useState(rootData.tree.fullPath);

  return (
    <SunburstContainer>
      <ChartContainer autoHeightResize={false}>
        <ReactEchartsCore
          echarts={echarts}
          onEvents={{
            mouseover: (params: Parameters<EChartMouseOverHandler>[0]) => {
              const splitPaths = params.data.fullPath.split('/');

              if (splitPaths.length > 2) {
                setBreadCrumbs(`../${splitPaths.slice(-2).join('/')}`);
              } else {
                setBreadCrumbs(params.data.fullPath);
              }
            },
            click: (params: Parameters<EChartClickHandler>[0]) => {
              if (params?.data?.type === 'dir') {
                const parent = rootData.edges.get(params.data.fullPath);
                const node = rootData.nodeMap.get(params.data?.fullPath);
                if (!node) {
                  return;
                }

                setRenderData(() => {
                  if (params.data.depth > 0 && parent) {
                    const children = bfsFilter(node, params.data?.depth + 1);

                    return {
                      ...parent,
                      name: parent.name,
                      itemStyle: {color: theme.blue300, opacity: 0.9},
                      children: [children],
                    } satisfies ProcessedSunburstData;
                  }

                  return bfsFilter(node, params.data?.depth + 2);
                });
              }
            },
          }}
          option={{
            tooltip: {
              show: true,
              trigger: 'item',
              backgroundColor: `${theme.backgroundElevated}`,
              borderWidth: 0,
              extraCssText: `box-shadow: 0 0 0 1px ${theme.translucentBorder}, ${theme.dropShadowHeavy}`,
              transitionDuration: 0,
              padding: 0,
              className: 'tooltip-container',
              // Default hideDelay in echarts docs is 100ms
              hideDelay: 100,
              /**
               * @link https://echarts.apache.org/en/option.html#tooltip.position
               *
               * @param pos mouse position
               * @param _params same as formatter
               * @param dom dom object of tooltip
               * @param _rec graphic elements
               * @param _size The size of dom echarts container.
               */
              position(pos, _params, dom, _rec, size) {
                // Types seem to be broken on dom
                dom = dom as HTMLDivElement;
                // Center the tooltip slightly above the cursor.
                const [tipWidth, tipHeight] = size.contentSize;

                let parentNode: Element = document.body;
                if (dom.parentNode instanceof Element) {
                  parentNode = dom.parentNode;
                }

                const chartElement: Element = parentNode;

                // Get the left offset of the tip container (the chart)
                // so that we can estimate overflows
                const chartBoundingRect = chartElement.getBoundingClientRect();
                const chartLeft = chartBoundingRect.left ?? 0;

                // Determine the new left edge.
                let leftPos = Number(pos[0]) - tipWidth / 2;
                // And the right edge taking into account the chart left offset
                const rightEdge = chartLeft + Number(pos[0]) + tipWidth / 2;

                let arrowPosition: string | undefined;
                if (rightEdge >= window.innerWidth - CHART_TOOLTIP_VIEWPORT_OFFSET) {
                  // If the tooltip would leave viewport on the right, pin it.
                  leftPos -=
                    rightEdge - window.innerWidth + CHART_TOOLTIP_VIEWPORT_OFFSET;
                  arrowPosition = `${Number(pos[0]) - leftPos}px`;
                } else if (leftPos + chartLeft - CHART_TOOLTIP_VIEWPORT_OFFSET <= 0) {
                  // If the tooltip would leave viewport on the left, pin it.
                  leftPos = chartLeft * -1 + CHART_TOOLTIP_VIEWPORT_OFFSET;
                  arrowPosition = `${Number(pos[0]) - leftPos}px`;
                } else {
                  // Tooltip not near the window edge, reset position
                  arrowPosition = '50%';
                }

                const arrow = dom.querySelector<HTMLDivElement>('.tooltip-arrow');
                if (arrow) {
                  arrow.style.left = arrowPosition;
                }

                return {
                  left: leftPos,
                  top: Math.max(
                    Number(pos[1]) - tipHeight - 20,
                    // avoid tooltip from being cut off by the top edge of the window
                    CHART_TOOLTIP_VIEWPORT_OFFSET - chartBoundingRect.top
                  ),
                };
              },
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
                ].join('');
              },
            } satisfies TooltipComponentOption,
            series: {
              animation: false,
              type: 'sunburst',
              data: [renderData],
              radius: [40, 100],
              label: {
                show: false,
              },
              emphasis: {
                focus: 'ancestor',
              },
              nodeClick: false,
              levels: [{}, {itemStyle: {color: theme.blue300}}, {}],
            },
          }}
        />
      </ChartContainer>
      <BreadCrumbContainer>{breadCrumbs}</BreadCrumbContainer>
    </SunburstContainer>
  );
}

const SunburstContainer = styled('div')``;

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
