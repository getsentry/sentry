import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import ReactECharts from 'echarts-for-react';

import {space} from 'sentry/styles/space';

import type {
  EChartsTreemapData,
  FileAnalysisReport,
  TreemapElement,
  TreemapType,
} from './types';
import {TreemapType as TreemapTypeEnum} from './types';

// Sentry color constants, see: https://develop.sentry.dev/frontend/component-library/
const COLORS = {
  // Base colors
  gray900: '#0F0C13',
  gray700: '#1E1825',
  gray500: '#2D2435',
  gray300: '#4A3B57',
  gray200: '#ddd',
  gray100: 'hsla(270, 20%, 50%, 0.5)',

  border: 'hsla(0, 0.00%, 0.00%, 0.8)',
  shadow: 'hsla(0, 0.00%, 0.00%, 0.4)',
  purple: 'hsla(252, 85%, 60%, 0.7)',
  indigo: 'hsla(265, 71%, 43%, 0.7)',
  pink: 'hsla(324, 91%, 59%, 0.7)',
  salmon: 'hsla(2, 95%, 71%, 0.7)',
  orange: 'hsla(33, 100%, 61%, 0.7)',
  kiwi: 'hsla(69, 80%, 40%, 0.60)',
  cyan: 'hsla(192, 100%, 50%, 0.5)',

  white: '#FFFFFF',
} as const;

interface TreemapVisualizationProps {
  data: FileAnalysisReport;
  sizeMode: 'install' | 'download';
}

function formatBytes(bytes: number, usesSiUnits: boolean): string {
  if (bytes === 0) return '0 Bytes';
  const k = usesSiUnits ? 1000 : 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getTypeColors(): Record<TreemapType, string> {
  return {
    // File Types
    [TreemapTypeEnum.FILES]: COLORS.gray100,
    [TreemapTypeEnum.EXECUTABLES]: COLORS.gray100,
    [TreemapTypeEnum.RESOURCES]: COLORS.gray100,
    [TreemapTypeEnum.ASSETS]: COLORS.gray100,

    // Platform Assets
    [TreemapTypeEnum.MANIFESTS]: COLORS.cyan,
    [TreemapTypeEnum.SIGNATURES]: COLORS.cyan,
    [TreemapTypeEnum.FONTS]: COLORS.cyan,

    // iOS Specific
    [TreemapTypeEnum.FRAMEWORKS]: COLORS.pink,
    [TreemapTypeEnum.PLISTS]: COLORS.pink,
    [TreemapTypeEnum.DYLD]: COLORS.pink,
    [TreemapTypeEnum.MACHO]: COLORS.pink,
    [TreemapTypeEnum.FUNCTION_STARTS]: COLORS.pink,
    [TreemapTypeEnum.CODE_SIGNATURE]: COLORS.pink,

    // Android Specific
    [TreemapTypeEnum.DEX]: COLORS.kiwi,
    [TreemapTypeEnum.NATIVE_LIBRARIES]: COLORS.kiwi,
    [TreemapTypeEnum.COMPILED_RESOURCES]: COLORS.kiwi,

    // Binary Analysis
    [TreemapTypeEnum.MODULES]: COLORS.cyan,
    [TreemapTypeEnum.CLASSES]: COLORS.cyan,
    [TreemapTypeEnum.METHODS]: COLORS.cyan,
    [TreemapTypeEnum.STRINGS]: COLORS.cyan,
    [TreemapTypeEnum.SYMBOLS]: COLORS.cyan,
    [TreemapTypeEnum.EXTERNAL_METHODS]: COLORS.cyan,

    // Catch-all
    [TreemapTypeEnum.OTHER]: COLORS.purple,
    [TreemapTypeEnum.UNMAPPED]: COLORS.purple,
  };
}

function convertToEChartsData(
  element: TreemapElement,
  sizeMode: 'install' | 'download',
  theme: any,
  typeColors: Record<TreemapType, string>
): EChartsTreemapData {
  const size = sizeMode === 'install' ? element.install_size : element.download_size;
  const color = element.element_type
    ? typeColors[element.element_type]
    : typeColors[TreemapTypeEnum.OTHER];

  let children: EChartsTreemapData[] | undefined;
  let totalSize = size;

  if (element.children && element.children.length > 0) {
    children = element.children.map(child =>
      convertToEChartsData(child, sizeMode, theme, typeColors)
    );
    // Calculate total size from children for directories
    if (element.is_directory) {
      totalSize = children.reduce((sum, child) => sum + (child.value || 0), 0);
    }
  }

  const data: EChartsTreemapData = {
    name: element.name,
    value: totalSize,
    itemStyle: {
      color: 'transparent',
      borderColor: color,
      borderWidth: 6,
      gapWidth: 2,
    },
    label: {
      fontSize: 12,
      fontWeight: 'bold',
      color: COLORS.white,
      fontFamily: theme.text.family,
      padding: 0,
      textShadowBlur: 2,
      textShadowColor: COLORS.shadow,
      textShadowOffsetY: 0.5,
    },
    upperLabel: {
      show: true,
      color: COLORS.white,
      backgroundColor: 'transparent',
      height: 24,
      fontSize: 12,
      fontWeight: 'bold',
      borderRadius: [2, 2, 0, 0],
      fontFamily: theme.text.family,
      padding: 0,
      textShadowBlur: 2,
      textShadowColor: COLORS.shadow,
      textShadowOffsetY: 0.5,
    },
  };

  if (children) {
    data.children = children;
  }

  return data;
}

function TreemapVisualization({data, sizeMode}: TreemapVisualizationProps) {
  const theme = useTheme();
  const typeColors = getTypeColors();

  const treemapData = data.treemap;
  const chartData = convertToEChartsData(treemapData.root, sizeMode, theme, typeColors);
  const totalSize =
    sizeMode === 'install'
      ? treemapData.total_install_size
      : treemapData.total_download_size;

  const option = {
    tooltip: {
      trigger: 'item',
      borderWidth: 0,
      backgroundColor: COLORS.white,
      hideDelay: 0,
      transitionDuration: 0,
      padding: 12,
      extraCssText: 'border-radius: 6px;',
      textStyle: {
        color: COLORS.gray500,
        fontFamily: theme.text.family,
      },
      formatter: function (info: any) {
        const value = info.value;
        const percent = ((value / totalSize) * 100).toFixed(2);
        const borderColor = info.data?.itemStyle?.borderColor || COLORS.gray300;

        return `
          <div>
            <div style="display: flex; align-items: center; font-size: 12px; font-family: ${theme.text.family}; font-weight: bold; line-height: 1;">
              <div style="width: 8px; height: 8px; border-radius: 50%; background-color: ${borderColor}; margin-right: 4px;"></div>
              <span style="color: ${COLORS.gray300}">Category Name</span>
            </div>
            <div style="font-family: ${theme.text.family}; line-height: 1;">
              <p style="font-size: 14px; font-weight: bold; margin-bottom: -2px;">${info.name}</p>
              <p style="font-size: 12px; margin-bottom: -4px;">Size: ${formatBytes(value, data.use_si_units)}</p>
              <p style="font-size: 12px;">Percentage: ${percent}%</p>
            </div>
          </div>
        `;
      },
    },
    series: [
      {
        name: 'Size Analysis',
        type: 'treemap',
        animationEasing: 'quarticOut',
        animationDuration: 300,
        height: '100%',
        width: '100%',
        top: '22',

        breadcrumb: {
          show: true,
          left: '0',
          top: '0',
          emphasis: {
            itemStyle: {
              color: COLORS.white,
              textStyle: {
                fontSize: 12,
                fontWeight: 'bold',
                fontFamily: theme.text.family,
                color: COLORS.gray500,
              },
            },
          },
          itemStyle: {
            textStyle: {
              fontSize: 12,
              fontWeight: 'bold',
              fontFamily: theme.text.family,
              color: COLORS.white,
            },
          },
        },
        zoomToNodeRatio: 0.1,
        visibleMin: 300,

        // Customize styles for each level
        levels: [
          {
            itemStyle: {
              gapWidth: 6,
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
    ],
    visualMap: {
      show: false,
      type: 'continuous',
      dimension: 1,
      min: 0,
      max: 1000,
      inRange: {
        colorSaturation: [0.1, 1],
      },
      seriesIndex: 0,
    },
  };

  return (
    <TreemapContainer>
      <ReactECharts
        option={option}
        style={{height: '100%', width: '100%'}}
        opts={{renderer: 'canvas'}}
      />
    </TreemapContainer>
  );
}

const TreemapContainer = styled('div')`
  width: 100%;
  height: 600px;
  background: ${COLORS.gray900};
  border: 1px solid ${p => p.theme.border};
  border-radius: 6px;
  margin: ${space(2)} 0;
`;

export default TreemapVisualization;
