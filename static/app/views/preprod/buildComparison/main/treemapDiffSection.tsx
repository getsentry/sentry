import {useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import type {ECharts, TreemapSeriesOption} from 'echarts';

import {Container, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator/separator';
import {Heading} from '@sentry/scraps/text';

import BaseChart, {type TooltipOption} from 'sentry/components/charts/baseChart';
import {IconContract} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Theme} from 'sentry/utils/theme';
import {getAppSizeDiffCategoryInfo} from 'sentry/views/preprod/components/visualizations/appSizeTreemapTheme';
import {TreemapControlButtons} from 'sentry/views/preprod/components/visualizations/treemapControlButtons';
import type {
  DiffItem,
  DiffType,
  TreemapDiffElement,
} from 'sentry/views/preprod/types/appSizeTypes';
import {formattedSizeDiff} from 'sentry/views/preprod/utils/labelUtils';
import {buildTreemapDiff} from 'sentry/views/preprod/utils/treemapDiffUtils';

interface TreemapDiffSectionProps {
  diffItems: DiffItem[];
}

export function TreemapDiffSection({diffItems}: TreemapDiffSectionProps) {
  const theme = useTheme();
  const [isZoomed, setIsZoomed] = useState(false);
  const chartRef = useRef<ECharts | null>(null);

  const treemapDiff = useMemo(() => {
    return buildTreemapDiff(diffItems);
  }, [diffItems]);

  if (!treemapDiff) {
    return null;
  }

  const handleChartReady = (chart: ECharts) => {
    chartRef.current = chart;
  };

  const handleContainerMouseDown = () => {
    setIsZoomed(true);
  };

  const handleRecenter = () => {
    if (chartRef.current) {
      chartRef.current.dispatchAction({
        type: 'treemapRootToNode',
        seriesIndex: 0,
      });
      setIsZoomed(false);
    }
  };

  function convertToEChartsData(element: TreemapDiffElement): any {
    const diffCategoryInfo = getAppSizeDiffCategoryInfo(theme)[element.diff_type];
    if (!diffCategoryInfo) {
      throw new Error(`Diff type ${element.diff_type} not found`);
    }

    const data: TreemapSeriesOption = {
      name: element.name,
      value: Math.abs(element.size_diff),
      path: element.path,
      size_diff: element.size_diff,
      diff_type: element.diff_type,
      itemStyle: {
        color: 'transparent',
        borderColor: diffCategoryInfo.translucentColor,
        borderWidth: 6,
        gapWidth: 2,
        // @ts-expect-error Type issue, just ignore
        gapColor: 'transparent',
      },
      label: {
        fontSize: 12,
        fontWeight: 'bold',
        color: theme.colors.white,
        fontFamily: 'Rubik',
        padding: 0,
        textShadowBlur: 2,
        textShadowColor: theme.colors.gray800,
        textShadowOffsetY: 0.5,
      },
      upperLabel: {
        show: true,
        color: theme.colors.white,
        backgroundColor: 'transparent',
        height: 24,
        fontSize: 12,
        fontWeight: 'bold',
        borderRadius: [2, 2, 0, 0],
        fontFamily: 'Rubik',
        padding: 0,
        textShadowBlur: 2,
        textShadowColor: theme.colors.gray800,
        textShadowOffsetY: 0.5,
      },
    };

    if (element.children && element.children.length > 0) {
      // @ts-expect-error Type issue, just ignore
      data.children = element.children.map((child: TreemapDiffElement) =>
        convertToEChartsData(child)
      );
    }

    return data;
  }

  const chartData = convertToEChartsData(treemapDiff);

  const series: TreemapSeriesOption[] = [
    {
      name: t('X-Ray Diff'),
      type: 'treemap',
      animationEasing: 'quarticOut',
      animationDuration: 300,
      height: `calc(100% - 22px)`,
      width: '100%',
      top: '22px',
      leafDepth: 100000,
      breadcrumb: {
        show: true,
        left: '0',
        top: '0',
        emphasis: {
          itemStyle: {
            color: theme.colors.surface200,
            textStyle: {
              fontSize: 12,
              fontWeight: 'bold',
              fontFamily: 'Rubik',
              color: theme.tokens.interactive.link.accent.rest,
            },
          },
        },
        itemStyle: {
          textStyle: {
            fontSize: 12,
            fontWeight: 'bold',
            fontFamily: 'Rubik',
            color: theme.colors.white,
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

  const tooltip: TooltipOption = {
    trigger: 'item',
    borderWidth: 0,
    backgroundColor: theme.tokens.background.primary,
    hideDelay: 0,
    transitionDuration: 0,
    padding: 12,
    extraCssText: 'border-radius: 6px;',
    textStyle: {
      color: theme.tokens.content.primary,
      fontFamily: 'Rubik',
    },
    formatter: function (params: any) {
      const pathElement = params.data?.path
        ? `<p style="font-size: 12px; margin-bottom: -4px;">${params.data.path}</p>`
        : null;

      const sizeDiff = params.data?.size_diff || 0;
      const diffType = params.data?.diff_type || 'unchanged';
      const diffCategoryInfo = getAppSizeDiffCategoryInfo(theme)[diffType];
      if (!diffCategoryInfo) {
        throw new Error(`Diff type ${diffType} not found`);
      }
      const diffTag = DiffTag(theme, sizeDiff, diffType, diffCategoryInfo.displayName);
      return `
        <div style="font-family: Rubik;">
          <div style="display: flex; flex-direction: column; line-height: 1; gap: ${theme.space.sm}">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 14px; font-weight: bold;">${params.name}</span>
            </div>
            ${pathElement || ''}
            <div style="display: flex; width: 100%;"><span style="display: inline-flex;">${diffTag}</span></div>
          </div>
        </div>
      `.trim();
    },
  };

  return (
    <Stack gap="xl">
      <Separator orientation="horizontal" border="primary" />

      <Stack gap="md">
        <Heading as="h2">{t('X-Ray Diff')}</Heading>
        <Stack paddingBottom="xl">
          <Container
            height="400px"
            width="100%"
            position="relative"
            onMouseDown={handleContainerMouseDown}
            style={{minHeight: 0}}
          >
            <BaseChart
              height={400}
              renderer="canvas"
              xAxis={null}
              yAxis={null}
              series={series}
              tooltip={tooltip}
              onChartReady={handleChartReady}
            />
            <TreemapControlButtons
              buttons={[
                {
                  ariaLabel: t('Recenter View'),
                  title: t('Recenter'),
                  icon: <IconContract />,
                  onClick: handleRecenter,
                  disabled: !isZoomed,
                },
              ]}
            />
          </Container>
        </Stack>
      </Stack>
    </Stack>
  );
}

type TagType = 'success' | 'danger' | 'muted';
const tagColors = (
  theme: Theme
): Record<TagType, {backgroundColor: string; color: string}> => ({
  success: {backgroundColor: theme.colors.green100, color: theme.colors.green500},
  danger: {backgroundColor: theme.colors.red100, color: theme.colors.red500},
  muted: {backgroundColor: theme.colors.surface500, color: theme.colors.gray500},
});

function DiffTag(
  theme: Theme,
  sizeDiff: number,
  diffType: DiffType,
  label: string
): string {
  const diffString = formattedSizeDiff(sizeDiff);
  let tagType: TagType = 'muted';
  if (diffType === 'increased' || diffType === 'added') {
    tagType = 'danger';
  } else if (diffType === 'decreased' || diffType === 'removed') {
    tagType = 'success';
  }

  // Intentionally a string as Echarts cannot render React components
  return `<div style="
    font-size: ${theme.font.size.sm};
    background-color: ${tagColors(theme)[tagType].backgroundColor};
    display: inline-flex;
    align-items: center;
    height: 20px;
    border-radius: 4px;
    padding: 0 ${theme.space.md};
    gap: ${theme.space.md};
    color: ${tagColors(theme)[tagType].color};
  ">
    <span style="
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: inline-block;
      font-weight: bold;
    ">
      ${diffString}
    </span>
    <span style="
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: inline-block;
    ">(${label})</span>
  </div>`;
}
