import {useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import type {ECharts, TreemapSeriesOption} from 'echarts';

import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {useRenderToString} from '@sentry/scraps/renderToString';
import {Separator} from '@sentry/scraps/separator/separator';
import {Heading, Text} from '@sentry/scraps/text';

import BaseChart, {type TooltipOption} from 'sentry/components/charts/baseChart';
import {IconContract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getAppSizeDiffCategoryInfo} from 'sentry/views/preprod/components/visualizations/appSizeTreemapTheme';
import {TreemapControlButtons} from 'sentry/views/preprod/components/visualizations/treemapControlButtons';
import type {DiffItem, TreemapDiffElement} from 'sentry/views/preprod/types/appSizeTypes';
import {formattedSizeDiff} from 'sentry/views/preprod/utils/labelUtils';
import {buildTreemapDiff} from 'sentry/views/preprod/utils/treemapDiffUtils';

interface TreemapDiffSectionProps {
  diffItems: DiffItem[];
}

export function TreemapDiffSection({diffItems}: TreemapDiffSectionProps) {
  const theme = useTheme();
  const [isZoomed, setIsZoomed] = useState(false);
  const chartRef = useRef<ECharts | null>(null);
  const renderToString = useRenderToString();

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
        color: theme.white,
        fontFamily: 'Rubik',
        padding: 0,
        textShadowBlur: 2,
        textShadowColor: theme.colors.gray800,
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
      const sizeDiff = params.data?.size_diff || 0;
      const diffType = params.data?.diff_type || 'unchanged';
      const diffCategoryInfo = getAppSizeDiffCategoryInfo(theme)[diffType];
      if (!diffCategoryInfo) {
        throw new Error(`Diff type ${diffType} not found`);
      }

      const diffString = formattedSizeDiff(sizeDiff);
      let tagType: TagType = 'muted';
      if (diffType === 'increased' || diffType === 'added') {
        tagType = 'danger';
      } else if (diffType === 'decreased' || diffType === 'removed') {
        tagType = 'success';
      }

      return renderToString(
        <Stack gap="sm">
          <Flex gap="sm">
            <Text bold>{params.name}</Text>
          </Flex>
          {params.data?.path ? <Text size="sm">{params.data.path}</Text> : null}
          <Tag variant={tagType}>{`${diffString} (${diffCategoryInfo.displayName})`}</Tag>
        </Stack>
      );
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
