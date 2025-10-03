import {useContext, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {TreemapSeriesOption, VisualMapComponentOption} from 'echarts';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import BaseChart, {type TooltipOption} from 'sentry/components/charts/baseChart';
import {Button} from 'sentry/components/core/button';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {Container, Flex} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text';
import {IconClose, IconExpand, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {ChartRenderingContext} from 'sentry/views/insights/common/components/chart';
import {getAppSizeCategoryInfo} from 'sentry/views/preprod/components/visualizations/appSizeTheme';
import {TreemapType, type TreemapElement} from 'sentry/views/preprod/types/appSizeTypes';
import {filterTreemapElement} from 'sentry/views/preprod/utils/treemapFiltering';

interface AppSizeTreemapProps {
  root: TreemapElement | null;
  searchQuery: string;
  onSearchChange?: (query: string) => void;
  unfilteredRoot?: TreemapElement;
}

function FullscreenModalContent({
  unfilteredRoot,
  initialSearch,
  onSearchChange,
}: {
  initialSearch: string;
  unfilteredRoot: TreemapElement;
  onSearchChange?: (query: string) => void;
}) {
  const [localSearch, setLocalSearch] = useState(initialSearch);
  const filteredRoot = filterTreemapElement(unfilteredRoot, localSearch, '');

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    onSearchChange?.(value);
  };

  return (
    <Container height="100%" width="100%">
      <Flex direction="column" gap="md" height="100%">
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
        <Container height="100%" width="100%">
          <AppSizeTreemap root={filteredRoot} searchQuery={localSearch} />
        </Container>
      </Flex>
    </Container>
  );
}

export function AppSizeTreemap(props: AppSizeTreemapProps) {
  const theme = useTheme();
  const {root, searchQuery, unfilteredRoot, onSearchChange} = props;
  const appSizeCategoryInfo = getAppSizeCategoryInfo(theme);
  const renderingContext = useContext(ChartRenderingContext);
  const isFullscreen = renderingContext?.isFullscreen ?? false;
  const contextHeight = renderingContext?.height;

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
      <Flex align="center" justify="center" height="100%">
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
      height: isFullscreen ? '100%' : `calc(100% - 22px)`,
      width: '100%',
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
    <Container height="100%" width="100%" position="relative">
      <BaseChart
        autoHeightResize={!isFullscreen}
        height={contextHeight}
        renderer="canvas"
        xAxis={null}
        yAxis={null}
        series={series}
        visualMap={visualMap}
        tooltip={tooltip}
      />
      {!isFullscreen && (
        <ButtonContainer direction="column" gap="sm" padding="sm" position="absolute">
          <Button
            size="xs"
            aria-label={t('Open Full-Screen View')}
            borderless
            icon={<IconExpand />}
            onClick={() => {
              openInsightChartModal({
                title: t('Size Analysis'),
                height: 500,
                children: unfilteredRoot ? (
                  <FullscreenModalContent
                    unfilteredRoot={unfilteredRoot}
                    initialSearch={searchQuery}
                    onSearchChange={onSearchChange}
                  />
                ) : (
                  <Container height="100%" width="100%">
                    <AppSizeTreemap root={root} searchQuery={searchQuery} />
                  </Container>
                ),
              });
            }}
          />
        </ButtonContainer>
      )}
    </Container>
  );
}

const ButtonContainer = styled(Flex)`
  top: -10px;
  right: 0;
  z-index: 10;
`;
