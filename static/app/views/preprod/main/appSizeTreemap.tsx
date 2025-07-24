import {useTheme} from '@emotion/react';
import type {TreemapSeriesOption, VisualMapComponentOption} from 'echarts';

import BaseChart, {type TooltipOption} from 'sentry/components/charts/baseChart';
import {space} from 'sentry/styles/space';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {type TreemapResults, TreemapType} from 'sentry/views/preprod/types/appSizeTypes';

interface AppSizeTreemapProps {
  treemapData: TreemapResults;
}

export function AppSizeTreemap(props: AppSizeTreemapProps) {
  const theme = useTheme();
  const {treemapData} = props;

  // TODO: Use theme colors
  const COLORS = {
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

  const TYPE_COLORS: Record<string, string> = {
    [TreemapType.FILES]: COLORS.gray100,
    [TreemapType.EXECUTABLES]: COLORS.gray100,
    [TreemapType.RESOURCES]: COLORS.gray100,
    [TreemapType.ASSETS]: COLORS.gray100,
    [TreemapType.MANIFESTS]: COLORS.cyan,
    [TreemapType.SIGNATURES]: COLORS.cyan,
    [TreemapType.FONTS]: COLORS.cyan,
    [TreemapType.FRAMEWORKS]: COLORS.pink,
    [TreemapType.EXTENSIONS]: COLORS.pink,
    [TreemapType.PLISTS]: COLORS.pink,
    [TreemapType.DYLD]: COLORS.pink,
    [TreemapType.MACHO]: COLORS.pink,
    [TreemapType.FUNCTION_STARTS]: COLORS.pink,
    [TreemapType.CODE_SIGNATURE]: COLORS.pink,
    [TreemapType.DEX]: COLORS.kiwi,
    [TreemapType.NATIVE_LIBRARIES]: COLORS.kiwi,
    [TreemapType.COMPILED_RESOURCES]: COLORS.kiwi,
    [TreemapType.MODULES]: COLORS.cyan,
    [TreemapType.CLASSES]: COLORS.cyan,
    [TreemapType.METHODS]: COLORS.cyan,
    [TreemapType.STRINGS]: COLORS.cyan,
    [TreemapType.SYMBOLS]: COLORS.cyan,
    [TreemapType.BINARY]: COLORS.cyan,
    [TreemapType.EXTERNAL_METHODS]: COLORS.cyan,
    [TreemapType.OTHER]: COLORS.purple,
    [TreemapType.UNMAPPED]: COLORS.purple,
  };

  function convertToEChartsData(element: any, sizeMode: 'install' | 'download'): any {
    const size = sizeMode === 'install' ? element.install_size : element.download_size;
    const color = element.element_type
      ? TYPE_COLORS[element.element_type]
      : TYPE_COLORS[TreemapType.OTHER];

    const data: any = {
      name: element.name,
      value: size,
      path: element.path,
      category: element.element_type,
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
        fontFamily: 'Rubik',
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
        fontFamily: 'Rubik',
        padding: 0,
        textShadowBlur: 2,
        textShadowColor: COLORS.shadow,
        textShadowOffsetY: 0.5,
      },
    };

    if (element.children && element.children.length > 0) {
      data.children = element.children.map((child: any) =>
        convertToEChartsData(child, sizeMode)
      );
    }

    return data;
  }

  // TODO: Add download size toggling
  const chartData = convertToEChartsData(treemapData.root, 'install');
  const totalSize = treemapData.total_install_size;

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
    backgroundColor: COLORS.white,
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
              <div style="display: flex; align-items: center; font-size: 12px; font-weight: bold; line-height: 1; margin-bottom: ${space(1)}; gap: ${space(1)}">
                <div style="flex: initial; width: 8px !important; height: 8px !important; border-radius: 50%; background-color: ${params.data?.itemStyle?.borderColor || theme.border};"></div>
                <span style="color: ${theme.textColor}">${params.data?.category || 'Other'}</span>
              </div>
              <div style="display: flex; flex-direction: column; line-height: 1; gap: ${space(0.5)}">
                <p style="font-size: 14px; font-weight: bold; margin-bottom: -2px;">${params.name}</p>
                <p style="font-size: 12px; margin-bottom: -4px;">${params.data?.path}</p>
                <p style="font-size: 12px; margin-bottom: -4px;">${formatBytesBase10(value)} (${percent}%)</p>
              </div>
            </div>
          `;
    },
  };

  return (
    <BaseChart
      autoHeightResize
      renderer="canvas"
      series={series}
      visualMap={visualMap}
      tooltip={tooltip}
    />
  );
}
