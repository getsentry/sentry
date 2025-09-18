import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {TreemapSeriesOption, VisualMapComponentOption} from 'echarts';

import BaseChart, {type TooltipOption} from 'sentry/components/charts/baseChart';
import {Heading} from 'sentry/components/core/text';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {getAppSizeCategoryInfo} from 'sentry/views/preprod/components/visualizations/appSizeTheme';
import {TreemapType, type TreemapElement} from 'sentry/views/preprod/types/appSizeTypes';

interface AppSizeTreemapProps {
  root: TreemapElement | null;
  searchQuery: string;
}

export function AppSizeTreemap(props: AppSizeTreemapProps) {
  const theme = useTheme();
  const {root} = props;
  const appSizeCategoryInfo = getAppSizeCategoryInfo(theme);

  function convertToEChartsData(element: TreemapElement): any {
    const categoryInfo =
      appSizeCategoryInfo[element.type] ?? appSizeCategoryInfo[TreemapType.OTHER];
    if (!categoryInfo) {
      throw new Error(`Category ${element.type} not found`);
    }

    // Use headerColor for parent nodes, regular color for leaf nodes
    const hasChildren = element.children && element.children.length > 0;
    const borderColor =
      hasChildren && categoryInfo.headerColor
        ? categoryInfo.headerColor
        : categoryInfo.color;

    const data: any = {
      name: element.name,
      value: element.size,
      path: element.path,
      category: element.type,
      itemStyle: {
        color: 'transparent',
        borderColor,
        borderWidth: 6,
        gapWidth: 2,
        gapColor: 'transparent',
      },
      label: {
        fontSize: 12,
        fontWeight: 'bold',
        color: theme.white,
        fontFamily: 'Rubik',
        padding: 0,
        textShadowBlur: 2,
        textShadowColor: theme.gray500,
        textShadowOffsetY: 0.5,
      },
      upperLabel: {
        show: true,
        color: theme.white,
        backgroundColor: 'transparent',
        height: 24,
        fontSize: 12,
        fontWeight: 'bold',
        borderRadius: [2, 2, 0, 0],
        fontFamily: 'Rubik',
        padding: 0,
        textShadowBlur: 2,
        textShadowColor: theme.gray500,
        textShadowOffsetY: 0.5,
      },
    };

    if (element.children && element.children.length > 0) {
      data.children = element.children.map((child: TreemapElement) =>
        convertToEChartsData(child)
      );
    }

    return data;
  }

  // Empty state
  if (root === null) {
    return (
      <EmptyContainer>
        <Heading as="h4">
          No files match your search:{'  '}
          <span
            style={{
              fontFamily: 'monospace',
              backgroundColor: theme.gray100,
              padding: theme.space.xs,
              borderRadius: theme.borderRadius,
            }}
          >
            {props.searchQuery}
          </span>
        </Heading>
      </EmptyContainer>
    );
  }

  const chartData = convertToEChartsData(root);
  const totalSize = root.size;

  const series: TreemapSeriesOption[] = [
    {
      name: 'Size Analysis',
      type: 'treemap',
      animationEasing: 'quarticOut',
      animationDuration: 300,
      height: `calc(100% - 22px)`,
      width: `100%`,
      top: '22px',
      breadcrumb: {
        show: true,
        left: '0',
        top: '0',
        emphasis: {
          itemStyle: {
            color: theme.surface100,
            textStyle: {
              fontSize: 12,
              fontWeight: 'bold',
              fontFamily: 'Rubik',
              color: theme.activeText,
            },
          },
        },
        itemStyle: {
          textStyle: {
            fontSize: 12,
            fontWeight: 'bold',
            fontFamily: 'Rubik',
            color: theme.white,
          },
        },
      },
      zoomToNodeRatio: 0.1,
      visibleMin: 300,
      levels: [
        {
          itemStyle: {
            gapWidth: 4,
            borderColor: 'transparent',
            borderRadius: 6,
          },
          colorSaturation: [0.3, 0.5],
        },
        {
          itemStyle: {
            borderRadius: 6,
          },
          colorSaturation: [0.4, 0.6],
        },
        {
          itemStyle: {
            borderRadius: 4,
          },
          colorSaturation: [0.4, 0.6],
        },
        {
          itemStyle: {
            borderRadius: 2,
          },
          colorSaturation: [0.4, 0.6],
        },
        {
          itemStyle: {
            borderRadius: 1,
          },
          colorSaturation: [0.4, 0.6],
        },
      ],
      data: chartData.children || [chartData],
    },
  ];

  const visualMap: VisualMapComponentOption = {
    show: false,
    type: 'continuous',
    dimension: 1,
    min: 0,
    max: 1000,
    inRange: {
      colorSaturation: [0.1, 1],
    },
    seriesIndex: 0,
  };

  const tooltip: TooltipOption = {
    trigger: 'item',
    borderWidth: 0,
    backgroundColor: theme.background,
    hideDelay: 0,
    transitionDuration: 0,
    padding: 12,
    extraCssText: 'border-radius: 6px;',
    textStyle: {
      color: theme.textColor,
      fontFamily: 'Rubik',
    },
    formatter: function (params: any) {
      const value = typeof params.value === 'number' ? params.value : 0;
      const percent = ((value / totalSize) * 100).toFixed(2);
      const pathElement = params.data?.path
        ? `<p style="font-size: 12px; margin-bottom: -4px;">${params.data.path}</p>`
        : null;

      return `
            <div style="font-family: Rubik;">
              <div style="display: flex; align-items: center; font-size: 12px; font-weight: bold; line-height: 1; margin-bottom: ${theme.space.md}; gap: ${theme.space.md}">
                <div style="flex: initial; width: 8px !important; height: 8px !important; border-radius: 50%; background-color: ${params.data?.itemStyle?.borderColor || theme.border};"></div>
                <span style="color: ${theme.textColor}">${params.data?.category || 'Other'}</span>
              </div>
              <div style="display: flex; flex-direction: column; line-height: 1; gap: ${theme.space.sm}">
                <p style="font-size: 14px; font-weight: bold; margin-bottom: -2px;">${params.name}</p>
                ${pathElement || ''}
                <p style="font-size: 12px; margin-bottom: -4px;">${formatBytesBase10(value)} (${percent}%)</p>
              </div>
            </div>
          `.trim();
    },
  };

  return (
    <BaseChart
      autoHeightResize
      renderer="canvas"
      xAxis={null}
      yAxis={null}
      series={series}
      visualMap={visualMap}
      tooltip={tooltip}
    />
  );
}

const EmptyContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
`;
