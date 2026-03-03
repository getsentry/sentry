import {useContext, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {ECharts, TreemapSeriesOption, VisualMapComponentOption} from 'echarts';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex} from '@sentry/scraps/layout';
import {useRenderToString} from '@sentry/scraps/renderToString';
import {Heading} from '@sentry/scraps/text';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import BaseChart, {type TooltipOption} from 'sentry/components/charts/baseChart';
import {
  IconClose,
  IconContract,
  IconExpand,
  IconFix,
  IconLightning,
  IconSearch,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {ChartRenderingContext} from 'sentry/views/insights/common/components/chart';
import {
  getAppSizeCategoryInfo,
  getOpaqueColorFromComposite,
} from 'sentry/views/preprod/components/visualizations/appSizeTreemapTheme';
import {
  TreemapControlButtons,
  type TreemapControlButton,
} from 'sentry/views/preprod/components/visualizations/treemapControlButtons';
import {
  TreemapType,
  type FlaggedInsight,
  type TreemapElement,
} from 'sentry/views/preprod/types/appSizeTypes';
import {getInsightConfig} from 'sentry/views/preprod/utils/insightProcessing';
import {filterTreemapElement} from 'sentry/views/preprod/utils/treemapFiltering';

interface AppSizeTreemapProps {
  highlightInsights: boolean;
  insightsAvailable: boolean;
  onHighlightInsightsChange: (enabled: boolean) => void;
  root: TreemapElement | null;
  searchQuery: string;
  alertMessage?: string;
  onAlertClick?: () => void;
  onSearchChange?: (query: string) => void;
  unfilteredRoot?: TreemapElement;
}

function FullscreenModalContent({
  unfilteredRoot,
  initialSearch,
  alertMessage,
  onAlertClick,
  onSearchChange,
  initialHighlightInsights,
  onHighlightInsightsChange,
  insightsAvailable,
}: {
  initialHighlightInsights: boolean;
  initialSearch: string;
  insightsAvailable: boolean;
  onHighlightInsightsChange: (enabled: boolean) => void;
  unfilteredRoot: TreemapElement;
  alertMessage?: string;
  onAlertClick?: () => void;
  onSearchChange?: (query: string) => void;
}) {
  const [localSearch, setLocalSearch] = useState(initialSearch);
  const [localHighlightInsights, setLocalHighlightInsights] = useState(
    initialHighlightInsights
  );
  const filteredRoot = filterTreemapElement(unfilteredRoot, localSearch, '');

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    onSearchChange?.(value);
  };

  const handleHighlightInsightsChange = (enabled: boolean) => {
    setLocalHighlightInsights(enabled);
    onHighlightInsightsChange(enabled);
  };

  return (
    <Flex direction="column" gap="md" height="100%" width="100%">
      <InputGroup>
        <InputGroup.LeadingItems>
          <IconSearch />
        </InputGroup.LeadingItems>
        <InputGroup.Input
          placeholder="Search files"
          value={localSearch}
          onChange={e => handleSearchChange(e.target.value)}
        />
        {localSearch && (
          <InputGroup.TrailingItems>
            <Button
              onClick={() => handleSearchChange('')}
              aria-label="Clear search"
              priority="transparent"
              size="zero"
            >
              <IconClose size="sm" />
            </Button>
          </InputGroup.TrailingItems>
        )}
      </InputGroup>
      <Container height="100%" width="100%" flex={1} minHeight={0}>
        <AppSizeTreemap
          root={filteredRoot}
          searchQuery={localSearch}
          alertMessage={alertMessage}
          onAlertClick={onAlertClick}
          highlightInsights={localHighlightInsights}
          onHighlightInsightsChange={handleHighlightInsightsChange}
          insightsAvailable={insightsAvailable}
        />
      </Container>
    </Flex>
  );
}

export function AppSizeTreemap(props: AppSizeTreemapProps) {
  const theme = useTheme();
  const {
    root,
    searchQuery,
    unfilteredRoot,
    alertMessage,
    onAlertClick,
    onSearchChange,
    highlightInsights,
    onHighlightInsightsChange,
    insightsAvailable,
  } = props;
  const appSizeCategoryInfo = getAppSizeCategoryInfo(theme);
  const renderToString = useRenderToString();
  const renderingContext = useContext(ChartRenderingContext);
  const isFullscreen = renderingContext?.isFullscreen ?? false;
  const contextHeight = renderingContext?.height;
  const chartRef = useRef<ECharts | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);

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

  const chartSurfaceColor = theme.tokens.background.primary;

  function convertToEChartsData(
    element: TreemapElement,
    parentCompositeColor: string = chartSurfaceColor
  ): any {
    const categoryInfo =
      appSizeCategoryInfo[element.type] ?? appSizeCategoryInfo[TreemapType.OTHER];
    if (!categoryInfo) {
      throw new Error(`Category ${element.type} not found`);
    }

    const hasChildren = element.children.length > 0;
    const hasFlaggedInsights =
      element.flagged_insights && element.flagged_insights.length > 0;
    const shouldHighlight = highlightInsights && hasFlaggedInsights;

    const baselineNodeColor =
      hasChildren && categoryInfo.translucentColor
        ? categoryInfo.translucentColor
        : categoryInfo.color;

    const compositeNodeColor = getOpaqueColorFromComposite(
      baselineNodeColor,
      parentCompositeColor
    );

    const borderColor = shouldHighlight
      ? theme.tokens.border.danger.vibrant
      : compositeNodeColor;

    const fillColor =
      shouldHighlight && !hasChildren
        ? getOpaqueColorFromComposite(
            theme.tokens.border.danger.vibrant,
            parentCompositeColor
          )
        : compositeNodeColor;

    const data: any = {
      name: element.name,
      value: element.size,
      path: element.path,
      category: element.type,
      misc: element.misc,
      flagged_insights: element.flagged_insights,
      itemStyle: {
        color: fillColor,
        borderColor,
        borderWidth: 6,
        gapWidth: 2,
        gapColor: fillColor,
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

    if (element.children.length > 0) {
      data.children = element.children.map((child: TreemapElement) =>
        convertToEChartsData(child, compositeNodeColor)
      );
    }

    return data;
  }

  // Empty state
  if (root === null) {
    return (
      <Flex align="center" justify="center" height="100%">
        <Heading as="h4">
          No files match your search:{'  '}
          <span
            style={{
              fontFamily: 'monospace',
              backgroundColor: theme.colors.gray100,
              padding: theme.space.xs,
              borderRadius: theme.radius.md,
            }}
          >
            {props.searchQuery}
          </span>
        </Heading>
      </Flex>
    );
  }

  const chartDataChildren = root.children.map((child: TreemapElement) =>
    convertToEChartsData(child, chartSurfaceColor)
  );
  const chartData =
    chartDataChildren.length > 0
      ? chartDataChildren
      : [convertToEChartsData(root, chartSurfaceColor)];
  const totalSize = root.size;

  const series: TreemapSeriesOption[] = [
    {
      name: 'Size Analysis',
      type: 'treemap',
      animationEasing: 'quarticOut',
      animationDuration: 300,
      height: `calc(100% - 22px)`,
      width: '100%',
      top: '22px',
      // Controls how many levels deep to render at once.
      // Users can click on nodes to drill down into deeper levels.
      // The breadcrumb shows the current path and allows navigating back up.
      leafDepth: 4,
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
            borderRadius: 6,
            borderColor: chartSurfaceColor,
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
      data: chartData,
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

  function formatInsightRow(insight: string | FlaggedInsight, index: number): string {
    const key = typeof insight === 'string' ? insight : insight.key;
    const savings = typeof insight === 'string' ? 0 : insight.savings;
    const savingsHtml =
      savings > 0
        ? `<span style="color: ${theme.tokens.content.secondary}; text-align: right; white-space: nowrap; min-width: 68px;">-${formatBytesBase10(savings)}</span>`
        : '';
    const bgColor = index % 2 === 0 ? theme.tokens.background.secondary : 'transparent';

    return `<div style="display: flex; align-items: flex-start; justify-content: space-between; padding: 4px; border-radius: 2px; background-color: ${bgColor}; line-height: 1.2; height: 22px; box-sizing: border-box;">
      <span style="color: ${theme.tokens.content.primary}; white-space: nowrap;">${getInsightConfig(key).name}</span>
      ${savingsHtml}
    </div>`;
  }

  function formatInsightsSection(insights: Array<string | FlaggedInsight>): string {
    if (insights.length === 0) {
      return '';
    }

    const rows = insights.map(formatInsightRow).join('');
    // Must be called inside the formatter callback, not at render time.
    // renderToString uses flushSync which React silently suppresses during render.
    const iconFixHtml = renderToString(<IconFix size="xs" variant="muted" />);

    return `<div style="border-top: 1px solid ${theme.tokens.border.secondary}; padding-top: 8px;">
      <div style="display: flex; align-items: center; gap: 6px; padding: 0 4px; margin-bottom: 6px;">
        ${iconFixHtml}
        <span style="font-size: 12px; color: ${theme.tokens.content.primary}; line-height: 1.4;">${t('Insights')}</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 2px; font-size: 12px;">
        ${rows}
      </div>
    </div>`;
  }

  const tooltip: TooltipOption = {
    trigger: 'item',
    borderWidth: 0,
    backgroundColor: theme.tokens.background.primary,
    hideDelay: 0,
    transitionDuration: 0,
    padding: [12, 8, 8, 8],
    extraCssText: `border-radius: 6px; border: 1px solid ${theme.tokens.border.secondary}; border-bottom-width: 2px;`,
    textStyle: {
      color: theme.tokens.content.primary,
      fontFamily: 'Rubik',
    },
    formatter: function (params: any) {
      const value = typeof params.value === 'number' ? params.value : 0;
      const percent = ((value / totalSize) * 100).toFixed(2);
      const pathHtml = params.data?.path
        ? `<div style="font-size: 12px; color: ${theme.tokens.content.secondary}; line-height: 1.2;">${params.data.path}</div>`
        : '';
      const scaleHtml = params.data?.misc?.scale
        ? `<span style="font-size: 10px; background-color: ${theme.tokens.background.secondary}; color: ${theme.tokens.content.primary}; padding: 4px; border-radius: 3px; font-weight: normal;">@${params.data.misc.scale}x</span>`
        : '';

      const dotColor = params.data?.itemStyle?.borderColor ?? theme.tokens.border.primary;
      const category = params.data?.category ?? 'Other';
      const insightsHtml = formatInsightsSection(params.data?.flagged_insights ?? []);

      return `
        <div style="font-family: Rubik; white-space: normal; line-height: 1.2; display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; flex-direction: column; gap: 6px; padding: 0 4px;">
            <div style="display: flex; align-items: center; font-size: 12px; font-weight: 500; line-height: 1.2; gap: 4px;">
              <span style="display: inline-block; flex: 0 0 6px; width: 6px; height: 6px; min-width: 6px; max-width: 6px; border-radius: 50%; background-color: ${dotColor};"></span>
              <span style="color: ${theme.tokens.content.primary}; white-space: nowrap;">${category}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 2px; padding-bottom: 6px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 14px; font-weight: 500; line-height: 1.2; color: ${theme.tokens.content.primary};">${params.name}</span>
                ${scaleHtml}
              </div>
              ${pathHtml}
              <div style="font-size: 12px; color: ${theme.tokens.content.secondary}; line-height: 1.2;">${formatBytesBase10(value)} ( ${percent}% )</div>
            </div>
          </div>
          ${insightsHtml}
        </div>
      `.trim();
    },
  };

  const treemapControlButtons: TreemapControlButton[] = [
    ...(insightsAvailable
      ? [
          {
            ariaLabel: t('Toggle Insight Highlighting'),
            title: highlightInsights ? t('Hide Insights') : t('Insights'),
            icon: <IconLightning />,
            onClick: () => onHighlightInsightsChange(!highlightInsights),
            disabled: false,
            active: highlightInsights,
          },
        ]
      : []),
    {
      ariaLabel: t('Recenter View'),
      title: t('Recenter'),
      icon: <IconContract />,
      onClick: handleRecenter,
      disabled: !isZoomed,
    },
  ];
  if (!isFullscreen) {
    treemapControlButtons.push({
      ariaLabel: t('Open Full-Screen View'),
      title: t('Fullscreen'),
      icon: <IconExpand />,
      disabled: false,
      onClick: () => {
        openInsightChartModal({
          title: t('Size Analysis'),
          fullscreen: true,
          children: unfilteredRoot ? (
            <FullscreenModalContent
              unfilteredRoot={unfilteredRoot}
              initialSearch={searchQuery}
              alertMessage={alertMessage}
              onAlertClick={onAlertClick}
              onSearchChange={onSearchChange}
              initialHighlightInsights={highlightInsights}
              onHighlightInsightsChange={onHighlightInsightsChange}
              insightsAvailable={insightsAvailable}
            />
          ) : (
            <Container height="100%" width="100%">
              <AppSizeTreemap
                root={root}
                searchQuery={searchQuery}
                alertMessage={alertMessage}
                onAlertClick={onAlertClick}
                highlightInsights={highlightInsights}
                onHighlightInsightsChange={onHighlightInsightsChange}
                insightsAvailable={insightsAvailable}
              />
            </Container>
          ),
        });
      },
    });
  }

  return (
    <Flex direction="column" gap="sm" height="100%" width="100%">
      {alertMessage && (
        <ClickableAlert
          variant="warning"
          onClick={onAlertClick}
          style={{cursor: onAlertClick ? 'pointer' : 'default'}}
        >
          {alertMessage}
        </ClickableAlert>
      )}
      <Container
        height="100%"
        width="100%"
        position="relative"
        onMouseDown={handleContainerMouseDown}
        flex={1}
        minHeight={0}
      >
        <BaseChart
          autoHeightResize
          height={contextHeight}
          renderer="canvas"
          xAxis={null}
          yAxis={null}
          series={series}
          visualMap={visualMap}
          tooltip={tooltip}
          onChartReady={handleChartReady}
        />
        <TreemapControlButtons buttons={treemapControlButtons} />
      </Container>
    </Flex>
  );
}

const ClickableAlert = styled(Alert)`
  &:hover {
    opacity: ${p => (p.onClick ? 0.9 : 1)};
  }
`;
