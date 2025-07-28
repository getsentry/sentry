import {useTheme} from '@emotion/react';
import type {PieSeriesOption} from 'echarts';

import BaseChart, {type TooltipOption} from 'sentry/components/charts/baseChart';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {APP_SIZE_CATEGORY_INFO} from 'sentry/views/preprod/components/visualizations/appSizeVizUtils';
import {type TreemapResults, TreemapType} from 'sentry/views/preprod/types/appSizeTypes';

interface AppSizeCategoriesProps {
  sizeMode: 'install' | 'download';
  treemapData: TreemapResults;
}

export function AppSizeCategories(props: AppSizeCategoriesProps) {
  const theme = useTheme();
  const {treemapData, sizeMode} = props;

  function calculateCategorySizes(element: any): Record<string, number> {
    const categorySizes: Record<string, number> = {};

    function traverse(node: any) {
      const size = sizeMode === 'install' ? node.install_size : node.download_size;
      const category = node.element_type || TreemapType.OTHER;

      if (category) {
        categorySizes[category] = (categorySizes[category] || 0) + size;
      }

      if (node.children && node.children.length > 0) {
        node.children.forEach((child: any) => traverse(child));
      }
    }

    traverse(element);
    return categorySizes;
  }

  const categorySizes = calculateCategorySizes(treemapData.root);
  const totalSize =
    sizeMode === 'install'
      ? treemapData.total_install_size
      : treemapData.total_download_size;

  const pieData = Object.entries(categorySizes)
    .filter(([_, size]) => size > 0)
    .map(([category, size]) => {
      const categoryInfo = APP_SIZE_CATEGORY_INFO[category];
      if (!categoryInfo) {
        throw new Error(`Category ${category} not found`);
      }

      return {
        name: categoryInfo.displayName,
        value: size,
        category,
        itemStyle: {
          color:
            APP_SIZE_CATEGORY_INFO[category]?.color ||
            APP_SIZE_CATEGORY_INFO[TreemapType.OTHER]?.color,
        },
      };
    })
    .sort((a, b) => b.value - a.value); // Sort by size descending

  const series: PieSeriesOption[] = [
    {
      name: 'Categories',
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 6,
        borderColor: theme.surface100,
        borderWidth: 2,
      },
      label: {
        show: true,
        position: 'outside',
        formatter: '{b}\n{d}%',
        fontSize: 12,
        fontFamily: 'Rubik',
        color: theme.textColor,
      },
      labelLine: {
        show: true,
        lineStyle: {
          color: theme.border,
        },
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 14,
          fontWeight: 'bold',
        },
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: theme.gray100,
        },
      },
      data: pieData,
    },
  ];

  const tooltip: TooltipOption = {
    trigger: 'item',
    borderWidth: 0,
    backgroundColor: theme.surface100,
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
      return `
            <div style="font-family: Rubik;">
              <div style="display: flex; align-items: center; font-size: 12px; font-weight: bold; line-height: 1; margin-bottom: ${theme.space.md}; gap: ${theme.space.md}">
                <div style="flex: initial; width: 8px !important; height: 8px !important; border-radius: 50%; background-color: ${params.color};"></div>
                <span style="color: ${theme.textColor}">${params.name}</span>
              </div>
              <div style="display: flex; flex-direction: column; line-height: 1; gap: ${theme.space.sm}">
                <p style="font-size: 14px; font-weight: bold; margin-bottom: -2px;">${formatBytesBase10(value)}</p>
                <p style="font-size: 12px; margin-bottom: -4px;">${percent}% of total size</p>
              </div>
            </div>
          `;
    },
  };

  return (
    <BaseChart autoHeightResize renderer="canvas" series={series} tooltip={tooltip} />
  );
}
