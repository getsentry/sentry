import {useContext, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {ECharts, TreemapSeriesOption, VisualMapComponentOption} from 'echarts';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input/inputGroup';
import {Container, Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import BaseChart, {type TooltipOption} from 'sentry/components/charts/baseChart';
import {IconClose, IconContract, IconExpand, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {ChartRenderingContext} from 'sentry/views/insights/common/components/chart';
import {getAppSizeCategoryInfo} from 'sentry/views/preprod/components/visualizations/appSizeTreemapTheme';
import {
  TreemapControlButtons,
  type TreemapControlButton,
} from 'sentry/views/preprod/components/visualizations/treemapControlButtons';
import {TreemapType, type TreemapElement} from 'sentry/views/preprod/types/appSizeTypes';
import {filterTreemapElement} from 'sentry/views/preprod/utils/treemapFiltering';

interface AppSizeTreemapProps {
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
}: {
  initialSearch: string;
  unfilteredRoot: TreemapElement;
  alertMessage?: string;
  onAlertClick?: () => void;
  onSearchChange?: (query: string) => void;
}) {
  const [localSearch, setLocalSearch] = useState(initialSearch);
  const filteredRoot = filterTreemapElement(unfilteredRoot, localSearch, '');

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    onSearchChange?.(value);
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
              borderless
              size="zero"
            >
              <IconClose size="sm" />
            </Button>
          </InputGroup.TrailingItems>
        )}
      </InputGroup>
      <Container height="100%" width="100%" style={{flex: 1, minHeight: 0}}>
        <AppSizeTreemap
          root={filteredRoot}
          searchQuery={localSearch}
          alertMessage={alertMessage}
          onAlertClick={onAlertClick}
        />
      </Container>
    </Flex>
  );
}

export function AppSizeTreemap(props: AppSizeTreemapProps) {
  const theme = useTheme();
  const {root, searchQuery, unfilteredRoot, alertMessage, onAlertClick, onSearchChange} =
    props;
  const appSizeCategoryInfo = getAppSizeCategoryInfo(theme);
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

  function convertToEChartsData(element: TreemapElement): any {
    const categoryInfo =
      appSizeCategoryInfo[element.type] ?? appSizeCategoryInfo[TreemapType.OTHER];
    if (!categoryInfo) {
      throw new Error(`Category ${element.type} not found`);
    }

    // Use headerColor for parent nodes, regular color for leaf nodes
    const hasChildren = element.children && element.children.length > 0;
    const borderColor =
      hasChildren && categoryInfo.translucentColor
        ? categoryInfo.translucentColor
        : categoryInfo.color;

    const data: any = {
      name: element.name,
      value: element.size,
      path: element.path,
      category: element.type,
      misc: element.misc,
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
      data.children = element.children.map((child: TreemapElement) =>
        convertToEChartsData(child)
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

  const chartData = convertToEChartsData(root);
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
      // Very mysteriously this controls the initial breadcrumbs:
      // https://github.com/apache/echarts/blob/6f305b497adc47fa2987a450d892d09741342c56/src/chart/treemap/TreemapView.ts#L665
      // If truthy the root is selected else the 'middle' node is selected.
      // It has to be set to large number to avoid problems caused by
      // leafDepth's main use - controlling how many layers to render.
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
      const value = typeof params.value === 'number' ? params.value : 0;
      const percent = ((value / totalSize) * 100).toFixed(2);
      const pathElement = params.data?.path
        ? `<p style="font-size: 12px; margin-bottom: -4px;">${params.data.path}</p>`
        : null;
      const scaleElement = params.data?.misc?.scale
        ? `<span style="font-size: 10px; background-color: ${theme.tokens.background.secondary}; color: ${theme.tokens.content.primary}; padding: 4px; border-radius: 3px; font-weight: normal;">@${params.data.misc.scale}x</span>`
        : '';

      return `
            <div style="font-family: Rubik;">
              <div style="display: flex; align-items: center; font-size: 12px; font-weight: bold; line-height: 1; margin-bottom: ${theme.space.md}; gap: ${theme.space.md}">
                <div style="flex: initial; width: 8px !important; height: 8px !important; border-radius: 50%; background-color: ${params.data?.itemStyle?.borderColor || theme.tokens.border.primary};"></div>
                <span style="color: ${theme.tokens.content.primary}">${params.data?.category || 'Other'}</span>
              </div>
              <div style="display: flex; flex-direction: column; line-height: 1; gap: ${theme.space.sm}">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 14px; font-weight: bold;">${params.name}</span>
                  ${scaleElement}
                </div>
                ${pathElement || ''}
                <p style="font-size: 12px; margin-bottom: -4px;">${formatBytesBase10(value)} (${percent}%)</p>
              </div>
            </div>
          `.trim();
    },
  };

  const treemapControlButtons: TreemapControlButton[] = [
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
            />
          ) : (
            <Container height="100%" width="100%">
              <AppSizeTreemap
                root={root}
                searchQuery={searchQuery}
                alertMessage={alertMessage}
                onAlertClick={onAlertClick}
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
        style={{flex: 1, minHeight: 0}}
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
