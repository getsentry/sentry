import {useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {ECharts, TreemapSeriesOption} from 'echarts';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator/separator';
import {Heading} from '@sentry/scraps/text';

import BaseChart, {type TooltipOption} from 'sentry/components/charts/baseChart';
import {IconContract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {getAppSizeDiffCategoryInfo} from 'sentry/views/preprod/components/visualizations/appSizeTreemapTheme';
import type {DiffItem, TreemapDiffElement} from 'sentry/views/preprod/types/appSizeTypes';
import {buildTreemapDiff} from 'sentry/views/preprod/utils/treemapDiffUtils';

interface TreemapDiffSectionProps {
  diffItems: DiffItem[];
}

export function TreemapDiffSection({diffItems}: TreemapDiffSectionProps) {
  const theme = useTheme();
  const [isZoomed, setIsZoomed] = useState(false);
  const chartRef = useRef<ECharts | null>(null);

  // Construct the treemap diff from available data
  const treemapDiff = useMemo(() => {
    return buildTreemapDiff(diffItems);
  }, [diffItems]);

  // Don't render if no diff data
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

    const data: any = {
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
      data.children = element.children.map((child: TreemapDiffElement) =>
        convertToEChartsData(child)
      );
    }

    return data;
  }

  const chartData = convertToEChartsData(treemapDiff);

  const series: TreemapSeriesOption[] = [
    {
      name: 'Size Diff Analysis',
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
      const diffColor = diffCategoryInfo.color;

      return `
        <div style="font-family: Rubik;">
          <div style="display: flex; align-items: center; font-size: 12px; font-weight: bold; line-height: 1; margin-bottom: ${theme.space.md}; gap: ${theme.space.md}">
            <div style="flex: initial; width: 8px !important; height: 8px !important; border-radius: 50%; background-color: ${diffColor};"></div>
            <span style="color: ${diffCategoryInfo.color}">${diffCategoryInfo.displayName || 'Other'}</span>
          </div>
          <div style="display: flex; flex-direction: column; line-height: 1; gap: ${theme.space.sm}">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 14px; font-weight: bold;">${params.name}</span>
            </div>
            ${pathElement || ''}
            ${sizeDiff === 0 ? '' : `<p style="font-size: 12px; margin-bottom: -4px; color: ${diffColor};">Change: ${sizeDiff > 0 ? '+' : ''}${formatBytesBase10(sizeDiff)}</p>`}
          </div>
        </div>
      `.trim();
    },
  };

  return (
    <Stack gap="xl">
      <Separator orientation="horizontal" border="primary" />

      <Stack gap="md">
        <Heading as="h2">{t('Size diff')}</Heading>
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
            <ButtonContainer
              gap="xs"
              align="center"
              direction="row"
              onMouseDown={e => e.stopPropagation()}
            >
              <Button
                size="xs"
                aria-label={t('Recenter View')}
                title={t('Recenter')}
                borderless
                icon={<IconContract />}
                onClick={handleRecenter}
                disabled={!isZoomed}
              />
            </ButtonContainer>
          </Container>
        </Stack>
      </Stack>
    </Stack>
  );
}

const ButtonContainer = styled(Flex)`
  position: absolute;
  top: 0px;
  right: 0;
  height: 20px;
  z-index: 10;

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${p => p.theme.white};
    height: 22px;
    min-height: 20px;
    max-height: 20px;
    padding: 0 ${p => p.theme.space.xs};
    background: rgba(0, 0, 0, 0.8);
    border-radius: ${p => p.theme.radius.md};
    box-shadow: ${p => p.theme.dropShadowMedium};

    &:hover {
      color: ${p => p.theme.white};
      background: rgba(0, 0, 0, 0.9);
    }
  }
`;
