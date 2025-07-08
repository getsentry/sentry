// Import Sankey chart type for ECharts
import 'echarts/lib/chart/sankey';
import 'echarts/lib/component/tooltip';
import 'echarts/lib/component/title';

import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {EChartsCoreOption, SankeySeriesOption} from 'echarts';
import * as echarts from 'echarts/core';
import ReactEchartsCore from 'echarts-for-react/lib/core';

import {getTooltipStyles} from 'sentry/components/charts/baseChart';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import type {ProjectSampleCount} from 'sentry/views/settings/dynamicSampling/utils/useProjectSampleCounts';

interface Props {
  isLoading: boolean;
  sampleCounts: ProjectSampleCount[];
  sampleRates: Record<string, number>; // Sample rates for each project
  selectedProjectId: string | null;
}

export function SankeyVisualization({
  selectedProjectId,
  sampleCounts,
  sampleRates,
  isLoading,
}: Props) {
  const theme = useTheme();

  const chartData = useMemo(() => {
    if (!selectedProjectId || !sampleCounts.length) {
      return null;
    }

    const selectedProject = sampleCounts.find(
      item => item.project.id === selectedProjectId
    );

    if (!selectedProject) {
      return null;
    }

    // Generate different colors for target projects
    const targetColors = [
      theme.blue300,
      theme.green300,
      theme.yellow300,
      theme.red300,
      theme.purple300,
      theme.pink300,
      theme.gray300,
    ];

    // Create nodes for the Sankey diagram
    const sourceNodeId = selectedProject.project.slug || 'source-project';
    const nodes = [
      {
        id: sourceNodeId,
        name:
          selectedProject.project.slug ||
          selectedProject.project.name ||
          'Unknown Project',
        itemStyle: {color: theme.purple300},
      },
    ];

    // Add a "Stored" node for the third column
    const storedNodeId = 'stored-spans';
    nodes.push({
      id: storedNodeId,
      name: 'Stored Spans',
      itemStyle: {color: theme.green400},
    });

    // Create links (flows) for the Sankey diagram
    const links: Array<{
      itemStyle: {color: string};
      source: string;
      target: string;
      value: number;
      label?: {formatter: string; show: boolean};
    }> = [];

    // Create a mapping from node IDs to node names for tooltip lookups
    const nodeIdToName: Record<string, string> = {};

    // Add source node to mapping
    nodeIdToName[sourceNodeId] =
      selectedProject.project.slug || selectedProject.project.name || 'Unknown Project';

    // Add stored node to mapping
    nodeIdToName[storedNodeId] = 'Stored Spans';

    // Create all target projects including the origin project itself
    const allTargetProjects = [
      // Add the origin project as the first target
      {
        project: selectedProject.project,
        count: selectedProject.ownCount, // Use ownCount for the origin project
      },
      // Add all sub-projects
      ...(selectedProject.subProjects || []),
    ];

    // Add target projects as nodes and create links
    allTargetProjects.forEach((targetProject, index) => {
      const targetNodeId = targetProject.project.slug || `project-${index}`;
      const projectName =
        targetProject.project.slug || targetProject.project.name || 'Unknown Project';
      const nodeColor = targetColors[index % targetColors.length];

      // Add target node to mapping
      nodeIdToName[targetNodeId] = projectName;

      // Add target node
      nodes.push({
        id: targetNodeId,
        name: projectName,
        itemStyle: {color: nodeColor || theme.gray300},
      });

      // Calculate accepted and stored spans using actual sample rates
      const acceptedSpans = targetProject.count; // 100% of incoming spans
      const projectSampleRate = sampleRates[targetProject.project.id.toString()] || 0;
      const storedSpans = Math.floor(acceptedSpans * projectSampleRate);

      // Flow 1: Source → Target (all accepted spans)
      links.push({
        source: sourceNodeId,
        target: targetNodeId,
        value: acceptedSpans,
        itemStyle: {color: nodeColor || theme.gray300},
        label: {
          show: true,
          formatter: `${formatAbbreviatedNumber(acceptedSpans)} accepted`,
        },
      });

      // Flow 2: Target → Stored (only stored spans)
      if (storedSpans > 0) {
        links.push({
          source: targetNodeId,
          target: storedNodeId,
          value: storedSpans,
          itemStyle: {color: theme.green300},
          label: {
            show: true,
            formatter: `${formatAbbreviatedNumber(storedSpans)} stored (${Math.round(projectSampleRate * 100)}%)`,
          },
        });
      }
    });

    return {nodes, links, nodeIdToName};
  }, [selectedProjectId, sampleCounts, sampleRates, theme]);

  const chartOptions = useMemo(() => {
    if (!chartData) {
      return null;
    }

    const option: EChartsCoreOption = {
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        ...getTooltipStyles({theme}),
        formatter: (params: any) => {
          if (params.dataType === 'node') {
            return `${params.data.name}`;
          }
          if (params.dataType === 'edge') {
            const sourceName =
              chartData.nodeIdToName[params.data.source] || params.data.source;
            const targetName =
              chartData.nodeIdToName[params.data.target] || params.data.target;
            return `${sourceName} → ${targetName}<br/>${formatAbbreviatedNumber(
              params.data.value
            )} spans`;
          }
          return '';
        },
      },
      series: [
        {
          type: 'sankey',
          data: chartData.nodes,
          links: chartData.links,
          emphasis: {
            focus: 'adjacency',
          },
          lineStyle: {
            color: 'gradient',
            curveness: 0.5,
          },
          itemStyle: {
            borderWidth: 1,
            borderColor: theme.border,
          },
          label: {
            fontSize: 12,
            color: theme.textColor,
          },
        } as SankeySeriesOption,
      ],
    };

    return option;
  }, [chartData, theme]);

  if (isLoading) {
    return (
      <StyledPanel>
        <PanelContent>
          <LoadingIndicator />
        </PanelContent>
      </StyledPanel>
    );
  }

  if (!selectedProjectId) {
    return (
      <StyledPanel>
        <PanelContent>
          <EmptyState>{t('Select a project to view span flow visualization')}</EmptyState>
        </PanelContent>
      </StyledPanel>
    );
  }

  if (!chartData || !chartOptions) {
    return (
      <StyledPanel>
        <PanelContent>
          <EmptyState>{t('No data available for selected project')}</EmptyState>
        </PanelContent>
      </StyledPanel>
    );
  }

  return (
    <StyledPanel>
      <PanelHeader>
        <Title>{t('Span Sampling Flow')}</Title>
        <Subtitle>{t('Accepted → Projects → Stored')}</Subtitle>
      </PanelHeader>
      <PanelContent>
        <ReactEchartsCore
          echarts={echarts}
          option={chartOptions}
          style={{height: '400px', width: '100%'}}
          opts={{renderer: 'svg'}}
        />
      </PanelContent>
    </StyledPanel>
  );
}

const StyledPanel = styled(Panel)`
  height: fit-content;
`;

const PanelHeader = styled('div')`
  padding: ${space(2)} ${space(2)} 0;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const Title = styled('h3')`
  font-size: ${p => p.theme.fontSize.lg};
  margin: 0 0 ${space(0.5)} 0;
`;

const Subtitle = styled('p')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  margin: 0 0 ${space(1)} 0;
`;

const PanelContent = styled('div')`
  padding: ${space(2)};
`;

const EmptyState = styled('div')`
  text-align: center;
  color: ${p => p.theme.subText};
  padding: ${space(4)};
`;
