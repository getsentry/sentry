import type {EChartsOption} from 'echarts';

import BaseChart from 'sentry/components/charts/baseChart';
import {Alert} from 'sentry/components/core/alert';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {AppSizeApiResponse} from 'sentry/views/preprod/appSizeTypes';

type BuildDetailsMainContentError = {error: string; status: 'error'};
type BuildDetailsMainContentLoading = {status: 'loading'};
type BuildDetailsMainContentSuccess = {
  appSizeData: AppSizeApiResponse;
  status: 'success';
};

export type BuildDetailsMainContentProps =
  | BuildDetailsMainContentError
  | BuildDetailsMainContentLoading
  | BuildDetailsMainContentSuccess;

export function BuildDetailsMainContent(props: BuildDetailsMainContentProps) {
  const {status} = props;

  if (status === 'loading') {
    return <LoadingIndicator />;
  }

  if (status === 'error') {
    return <Alert type="error">{props.error}</Alert>;
  }

  const {appSizeData} = props;

  // --- Color and Type Constants ---
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

  // If you have a TreemapType enum, use it here. Otherwise, fallback to string keys.
  const TreemapType = {
    FILES: 'FILES',
    EXECUTABLES: 'EXECUTABLES',
    RESOURCES: 'RESOURCES',
    ASSETS: 'ASSETS',
    MANIFESTS: 'MANIFESTS',
    SIGNATURES: 'SIGNATURES',
    FONTS: 'FONTS',
    FRAMEWORKS: 'FRAMEWORKS',
    EXTENSIONS: 'EXTENSIONS',
    PLISTS: 'PLISTS',
    DYLD: 'DYLD',
    MACHO: 'MACHO',
    FUNCTION_STARTS: 'FUNCTION_STARTS',
    CODE_SIGNATURE: 'CODE_SIGNATURE',
    DEX: 'DEX',
    NATIVE_LIBRARIES: 'NATIVE_LIBRARIES',
    COMPILED_RESOURCES: 'COMPILED_RESOURCES',
    MODULES: 'MODULES',
    CLASSES: 'CLASSES',
    METHODS: 'METHODS',
    STRINGS: 'STRINGS',
    SYMBOLS: 'SYMBOLS',
    EXTERNAL_METHODS: 'EXTERNAL_METHODS',
    OTHER: 'OTHER',
    UNMAPPED: 'UNMAPPED',
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
    [TreemapType.EXTERNAL_METHODS]: COLORS.cyan,
    [TreemapType.OTHER]: COLORS.purple,
    [TreemapType.UNMAPPED]: COLORS.purple,
  };

  // --- Utility Functions ---
  function formatBytes(bytes: number, usesSiUnits: boolean): string {
    if (bytes === 0) return '0 Bytes';
    const k = usesSiUnits ? 1000 : 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function convertToEChartsData(element: any, sizeMode: 'install' | 'download'): any {
    const size = sizeMode === 'install' ? element.install_size : element.download_size;
    const color = element.element_type
      ? TYPE_COLORS[element.element_type]
      : TYPE_COLORS[TreemapType.OTHER];

    const data: any = {
      name: element.name,
      value: size,
      path: element.path,
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

  // --- Data Extraction ---
  const treemapData = appSizeData.treemap;
  const chartData = convertToEChartsData(treemapData.root, 'install');
  // const totalSize =
  //   'install' === 'install'
  //     ? treemapData.total_install_size
  //     : treemapData.total_download_size;
  const totalSize = treemapData.total_install_size;

  // --- Chart Option ---
  const option: EChartsOption = {
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
        fontFamily: 'Rubik',
      },
      formatter: function (info: {name: string; value: number; data?: any}) {
        const value = info.value;
        const percent = ((value / totalSize) * 100).toFixed(2);
        return `
              <div>
                <div style="display: flex; align-items: center; font-size: 12px; font-family: Rubik; font-weight: bold; line-height: 1;">
                  <div style="width: 8px; height: 8px; border-radius: 50%; background-color: ${info.data?.itemStyle?.borderColor || COLORS.gray300}; margin-right: 4px;"></div>
                  <span style="color: ${COLORS.gray300}">Category Name</span>
                </div>
                <div style="font-family: Rubik; line-height: 1;">
                  <p style="font-size: 14px; font-weight: bold; margin-bottom: -2px;">${info.name}</p>
                  <p style="font-size: 12px; margin-bottom: -4px;">${info.data?.path}</p>
                  <p style="font-size: 12px; margin-bottom: -4px;">Size: ${formatBytes(value, false)}</p>
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
        height: `100%`,
        width: `100%`,
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
                fontFamily: 'Rubik',
                color: COLORS.gray500,
              },
            },
          },
          itemStyle: {
            textStyle: {
              fontSize: 12,
              fontWeight: 'bold',
              fontFamily: 'Rubik',
              color: COLORS.white,
            },
          },
        },
        zoomToNodeRatio: 0.1,
        visibleMin: 300,
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
    // <div style={{width: '100%', height: '600px'}}>
    <BaseChart
      renderer="canvas"
      // options={option}
      series={option.series as any}
      tooltip={option.tooltip as any}
      visualMap={option.visualMap as any}
      colors={theme => [theme.purple300, theme.purple200]}
    />
    // </div>
  );
}
