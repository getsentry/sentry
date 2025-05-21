import {Fragment, useMemo, useState} from 'react';
import {ClassNames, css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import EmptyMessage from 'sentry/components/emptyMessage';
import useDrawer from 'sentry/components/globalDrawer';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import {Hovercard} from 'sentry/components/hovercard';
import Link from 'sentry/components/links/link';
import Panel from 'sentry/components/panels/panel';
import TextOverflow from 'sentry/components/textOverflow';
import {
  IconChevron,
  IconCode,
  IconCopy,
  IconFile,
  IconProject,
  IconSearch,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventsStats} from 'sentry/types/organization';
import getDuration from 'sentry/utils/duration/getDuration';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {PerformanceBadge} from 'sentry/views/insights/browser/webVitals/components/performanceBadge';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/platform/laravel/utils';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';

interface TreeResponseItem {
  // Required fields (sorted alphabetically)
  'count()': number;
  'function.nextjs.component_type': string;
  'function.nextjs.path': string[];
  'span.description': string;
  // Optional / context-dependent fields
  'avg(measurements.lcp)'?: number;
  'avg(span.duration)'?: number;
  'failure_rate()'?: number;
  'p95(span.duration)'?: number;
  'performance_score(measurements.score.total)'?: number;
  'project.id'?: number;
  'span.op'?: string;
  'sum(measurements.lcp)'?: number;
  'sum(span.duration)'?: number;
  transaction?: string;
}

interface TreeResponse extends Omit<EventsStats, 'data'> {
  data: TreeResponseItem[];
}

type TreeNode = TreeContainer | TreeLeaf;

interface TreeContainer {
  children: TreeNode[];
  name: string;
  type: 'folder' | 'file';
  // Aggregated metrics (general)
  'avg(span.duration)'?: number;
  // Changed from avgPageloadDuration
  avgPageloadFailureRate?: number;
  // Page-level aggregated metrics from pageloads
  avgPageloadLcp?: number;
  avgPageloadPerfScore?: number;
  'count()'?: number;
  'failure_rate()'?: number;
  hasPageloadDescendant?: boolean;
  hasSingleVisibleChildNamedComponent?: boolean;
  // For inlining a single component child
  inlinedComponentAvgSsrDuration?: number;
  inlinedComponentCount?: number;
  inlinedComponentDescription?: string;
  inlinedComponentName?: string;
  isSingleComponentContainer?: boolean;
  'p95(span.duration)'?: number;
  'performance_score(measurements.score.total)'?: number;
  'sum(span.duration)'?: number;
  totalPageloadCount?: number;
}

interface TreeLeaf {
  'count()': number;
  name: string;
  pageloadCount: number;
  pageloadSumAvgDuration: number;
  pageloadSumPerfScore: number;
  pageloadWeightedFailureRateSum: number;
  'span.description': string;
  type: 'component' | 'pageload';
  'avg(span.duration)'?: number;
  avgLcp?: number;
  'failure_rate()'?: number;
  'p95(span.duration)'?: number;
  'performance_score(measurements.score.total)'?: number;
  'project.id'?: number;
  'sum(span.duration)'?: number;
  sumLcp?: number;
  transaction?: string;
}

const WIDGET_TITLE = t('Server Side Rendering');
const HOVERCARD_BODY_CLASS_NAME = 'ssrTreeHovercard';

export function getFileAndFunctionName(componentType: string) {
  // There are two cases:
  // 1. The function is the component -> "{fileName} Server Component"
  // 2. The function is a function inside the component -> "{fileName}.{functionName}"
  const componentMatch = componentType.match(/^(.*)\sServer Component$/);
  if (componentMatch?.[1]) {
    return {file: componentMatch[1].toLowerCase(), functionName: 'Component'};
  }

  const functionMatch = componentType.match(/^(.*)\.(.*)$/);
  if (functionMatch?.[1] && functionMatch?.[2]) {
    return {
      file: functionMatch[1].toLowerCase(),
      functionName: functionMatch[2],
    };
  }

  // Fallback if the component type doesn't match the expected pattern
  // The component will still be displayed but not attached to a file
  return {file: null, functionName: componentType};
}

export function mapResponseToTree(
  treeResponse: TreeResponseItem[],
  pageloadResponse?: TreeResponseItem[]
): TreeContainer {
  const root: TreeContainer = {
    children: [],
    name: 'root',
    type: 'folder',
  };

  // Each item of the response is a component in the tree with a path
  for (const item of treeResponse) {
    const path = item['function.nextjs.path'];
    let currentFolder: TreeContainer = root;

    const {file, functionName} = getFileAndFunctionName(
      item['function.nextjs.component_type']
    );

    const fullPath = [...path];
    if (file) {
      fullPath.push(file);
    }

    // Iterate over the path segments and create folders if they don't exist yet
    for (const segment of fullPath) {
      const child = currentFolder.children.find(c => c.name === segment);
      if (child) {
        currentFolder = child as TreeContainer;
      } else {
        const newFolder: TreeContainer = {
          children: [],
          name: segment,
          type: file === segment ? 'file' : 'folder',
        };
        currentFolder.children.push(newFolder);
        currentFolder = newFolder;
      }
    }

    // Add the component to the last folder in the path
    currentFolder.children.push({
      name: functionName,
      type: 'component',
      'avg(span.duration)': item['avg(span.duration)'],
      'count()': item['count()'],
      'sum(span.duration)': item['avg(span.duration)'] * item['count()'], // Calculate sum
      'span.description': item['span.description'],
      // Initialize pageload-specific fields for components (required by TreeLeaf type)
      pageloadCount: 0,
      pageloadSumAvgDuration: 0,
      pageloadSumPerfScore: 0,
      pageloadWeightedFailureRateSum: 0,
      // Other optional fields that might be on TreeLeaf but not on TreeResponseItem for components:
      'failure_rate()': undefined, // Or a sensible default if applicable
      'p95(span.duration)': undefined,
      'performance_score(measurements.score.total)': undefined,
      'project.id': undefined, // Assuming components don't have project.id from treeResponse
      transaction: undefined,
    } as TreeLeaf); // Explicit cast might be needed if TS struggles with discrimination via initializers
  }

  if (pageloadResponse) {
    for (const item of pageloadResponse) {
      const transaction = item.transaction;
      if (!transaction) {
        continue;
      }

      const pathSegments = transaction
        .replace(/^\/|\/$/g, '') // Remove leading/trailing slashes
        .split('/');

      let currentFolder: TreeContainer | undefined = root;
      for (const segment of pathSegments) {
        const segmentName = segment.toLowerCase();
        let foundChild: TreeNode | undefined = undefined;

        // 1. Attempt exact match first
        if (currentFolder?.children) {
          for (const c of currentFolder.children) {
            const decodedNodeName = decodeURIComponent(c.name);
            const normalizedNodeName = decodedNodeName
              .replace(/\.(js|jsx|ts|tsx)$/, '')
              .toLowerCase();
            if (
              normalizedNodeName === segmentName &&
              (c.type === 'file' || c.type === 'folder') // Ensure it's a container type
            ) {
              foundChild = c;
              break;
            }
          }
        }

        // 2. If no exact match, attempt wildcard match
        if (!foundChild && currentFolder?.children) {
          for (const c of currentFolder.children) {
            const decodedNodeName = decodeURIComponent(c.name);
            const normalizedNodeName = decodedNodeName
              .replace(/\.(js|jsx|ts|tsx)$/, '')
              .toLowerCase();
            if (
              normalizedNodeName.startsWith('[') &&
              normalizedNodeName.endsWith(']') &&
              (c.type === 'file' || c.type === 'folder') // Ensure it's a container type
            ) {
              foundChild = c;
              break;
            }
          }
        }

        if (foundChild && (foundChild.type === 'file' || foundChild.type === 'folder')) {
          // We need to assign to currentFolder, which is TreeContainer | undefined.
          // foundChild is TreeNode. A TreeNode can be TreeLeaf or TreeContainer.
          // If foundChild is a TreeLeaf, this assignment is problematic for the next iteration's currentFolder.children access.
          // However, our (c.type === 'file' || c.type === 'folder') check above should ensure foundChild is a TreeContainer.
          currentFolder = foundChild;
        } else {
          currentFolder = undefined; // Path broken or found child is not a suitable container
          break;
        }
      }

      let targetFileNode: TreeContainer | undefined = undefined;
      if (currentFolder) {
        if (currentFolder.type === 'file') {
          targetFileNode = currentFolder;
        } else if (currentFolder.type === 'folder') {
          const pageFile = currentFolder.children.find(c => {
            if (c.type !== 'file') return false;
            const decodedNodeName = decodeURIComponent(c.name);
            const normalizedChildName = decodedNodeName
              .replace(/\.(js|jsx|ts|tsx)$/, '')
              .toLowerCase();
            return normalizedChildName === 'page';
          });
          if (pageFile && pageFile.type === 'file') {
            targetFileNode = pageFile;
          }
        }
      }

      if (targetFileNode) {
        if (!targetFileNode.children) {
          targetFileNode.children = [];
        }

        // Find or create the "pages" subfolder
        let pagesFolder = targetFileNode.children.find(
          (child): child is TreeContainer =>
            child.type === 'folder' && child.name === 'transactions'
        );

        if (!pagesFolder) {
          pagesFolder = {
            name: 'transactions',
            type: 'folder',
            children: [],
            hasPageloadDescendant: true, // This folder is specifically for pageloads
          };
          targetFileNode.children.push(pagesFolder);
        }

        const transactionName = item.transaction!; // We know transaction is defined

        const existingLeaf = pagesFolder.children.find(
          (child): child is TreeLeaf =>
            child.type === 'pageload' && child.transaction === transactionName
        );

        if (existingLeaf) {
          // Aggregate data
          const newItemCount = item['count()'];
          const newItemSumDuration = item['sum(span.duration)'];

          const originalExistingLeafCount = existingLeaf['count()'];

          // Sum counts
          existingLeaf['count()'] = originalExistingLeafCount + newItemCount;

          // Sum durations
          existingLeaf['sum(span.duration)'] =
            (existingLeaf['sum(span.duration)'] ?? 0) + (newItemSumDuration ?? 0);

          // Recalculate average duration
          if (existingLeaf['count()'] > 0) {
            existingLeaf['avg(span.duration)'] =
              (existingLeaf['sum(span.duration)'] ?? 0) / existingLeaf['count()'];
          } else {
            existingLeaf['avg(span.duration)'] = 0;
          }

          // Weighted average for failure rate
          const newItemFR = item['failure_rate()'];
          if (typeof newItemFR === 'number' && newItemCount >= 0) {
            const oldAggregatedFR = existingLeaf['failure_rate()'];
            if (typeof oldAggregatedFR === 'number' && originalExistingLeafCount > 0) {
              const totalCombinedCount = originalExistingLeafCount + newItemCount;
              if (totalCombinedCount > 0) {
                existingLeaf['failure_rate()'] =
                  (oldAggregatedFR * originalExistingLeafCount +
                    newItemFR * newItemCount) /
                  totalCombinedCount;
              } else {
                existingLeaf['failure_rate()'] = newItemFR;
              }
            } else {
              existingLeaf['failure_rate()'] = newItemFR;
            }
          }

          // For P95 and Perf Score, overwrite if new item provides value
          if (item['p95(span.duration)'] !== undefined) {
            existingLeaf['p95(span.duration)'] = item['p95(span.duration)'];
          }
          if (item['performance_score(measurements.score.total)'] !== undefined) {
            existingLeaf['performance_score(measurements.score.total)'] =
              item['performance_score(measurements.score.total)'];
          }
          if (item['project.id'] !== undefined) {
            existingLeaf['project.id'] = item['project.id'];
          }

          // LCP aggregation for existingLeaf
          const newItemAvgLcp = item['avg(measurements.lcp)'];
          const newItemSumLcp = item['sum(measurements.lcp)'];
          const currentItemCount = item['count()']; // item count should always be a number

          if (typeof newItemSumLcp === 'number') {
            existingLeaf.sumLcp = (existingLeaf.sumLcp ?? 0) + newItemSumLcp;
          } else if (typeof newItemAvgLcp === 'number') {
            // Only use avg if sum is not available, and avg is available
            existingLeaf.sumLcp =
              (existingLeaf.sumLcp ?? 0) + newItemAvgLcp * currentItemCount;
          }
          // Recalculate avgLcp if sumLcp was updated and count is valid
          if (
            (typeof newItemSumLcp === 'number' || typeof newItemAvgLcp === 'number') &&
            existingLeaf['count()'] > 0
          ) {
            existingLeaf.avgLcp = (existingLeaf.sumLcp ?? 0) / existingLeaf['count()'];
          } else if (!existingLeaf.avgLcp && existingLeaf['count()'] <= 0) {
            // Initializing case for 0 count
            existingLeaf.avgLcp = 0;
          }
          // If existingLeaf.sumLcp is still undefined here, it means no LCP data came from the new item to update it.
        } else {
          pagesFolder.children.push({
            name: transactionName,
            type: 'pageload',
            'avg(span.duration)': item['avg(span.duration)'],
            avgLcp: item['avg(measurements.lcp)'],
            'count()': item['count()'],
            'span.description': transactionName,
            transaction: item.transaction,
            'failure_rate()': item['failure_rate()'],
            'p95(span.duration)': item['p95(span.duration)'],
            'performance_score(measurements.score.total)':
              item['performance_score(measurements.score.total)'],
            'project.id': item['project.id'],
            'sum(span.duration)': item['sum(span.duration)'],
            sumLcp:
              item['sum(measurements.lcp)'] ??
              (item['avg(measurements.lcp)'] ?? 0) * item['count()'],
            pageloadCount: 0,
            pageloadSumAvgDuration: 0,
            pageloadSumPerfScore: 0,
            pageloadWeightedFailureRateSum: 0,
          } as TreeLeaf);
        }
      }
    }
  }

  return root;
}

// Helper function to recursively aggregate metrics up the tree
interface AggregationResult {
  count: number;
  foundPageload: boolean;
  pageloadCount: number;
  pageloadSumLcp: number;
  pageloadSumPerfScore: number;
  pageloadWeightedFailureRateSum: number;
  sumDuration: number;
  weightedFailureRateSum: number;
}

function aggregateTreeMetricsRecursive(node: TreeNode): AggregationResult {
  if (node.type === 'component' || node.type === 'pageload') {
    const leaf = node;
    const count = leaf['count()'] ?? 0;
    let sumDuration = leaf['sum(span.duration)'];

    if (
      typeof sumDuration !== 'number' &&
      leaf.type === 'component' &&
      typeof leaf['avg(span.duration)'] === 'number' &&
      count > 0
    ) {
      sumDuration = leaf['avg(span.duration)'] * count;
      (leaf as any)['sum(span.duration)'] = sumDuration;
    }
    sumDuration = sumDuration ?? 0;

    const failureRate = leaf['failure_rate()'];
    const weightedFR =
      typeof failureRate === 'number' && count > 0 ? failureRate * count : 0;

    if (leaf.type === 'pageload') {
      const pageloadPerfScore = leaf['performance_score(measurements.score.total)'];
      const pageloadFailureRate = leaf['failure_rate()'];

      let sumLcpForLeaf = 0;
      if (typeof leaf.sumLcp === 'number') {
        sumLcpForLeaf = leaf.sumLcp;
      } else if (typeof leaf.avgLcp === 'number') {
        sumLcpForLeaf = leaf.avgLcp * count;
      }

      return {
        count,
        sumDuration,
        weightedFailureRateSum: weightedFR,
        foundPageload: true,
        pageloadCount: count,
        pageloadSumLcp: sumLcpForLeaf,
        pageloadSumPerfScore:
          (typeof pageloadPerfScore === 'number' ? pageloadPerfScore : 0) * count,
        pageloadWeightedFailureRateSum:
          typeof pageloadFailureRate === 'number' && count > 0
            ? pageloadFailureRate * count
            : 0,
      };
    }

    // It's a component
    return {
      count,
      sumDuration,
      weightedFailureRateSum: weightedFR,
      foundPageload: false,
      pageloadCount: 0,
      pageloadSumLcp: 0,
      pageloadSumPerfScore: 0,
      pageloadWeightedFailureRateSum: 0,
    };
  }

  // It's a TreeContainer
  const container = node as TreeContainer;
  let currentAggCount = 0;
  let currentAggSumDuration = 0;
  let currentAggWeightedFailureRateSum = 0;
  let subtreeHasPageload = false;

  let currentTotalPageloadCount = 0;
  let currentSumPageloadLcp = 0;
  let currentSumPageloadPerfScore = 0;
  let currentSumPageloadWeightedFailureRate = 0;

  if (container.children) {
    for (const child of container.children) {
      const childAggregates = aggregateTreeMetricsRecursive(child);
      currentAggCount += childAggregates.count;
      currentAggSumDuration += childAggregates.sumDuration;
      currentAggWeightedFailureRateSum += childAggregates.weightedFailureRateSum;

      currentTotalPageloadCount += childAggregates.pageloadCount;
      currentSumPageloadLcp += childAggregates.pageloadSumLcp;
      currentSumPageloadPerfScore += childAggregates.pageloadSumPerfScore;
      currentSumPageloadWeightedFailureRate +=
        childAggregates.pageloadWeightedFailureRateSum;

      if (childAggregates.foundPageload) {
        subtreeHasPageload = true;
      }
    }
  }

  container.hasPageloadDescendant = subtreeHasPageload;

  if (currentAggCount > 0) {
    container['count()'] = currentAggCount;
    container['sum(span.duration)'] = currentAggSumDuration;
    container['avg(span.duration)'] = currentAggSumDuration / currentAggCount;
    container['failure_rate()'] = currentAggWeightedFailureRateSum / currentAggCount;
  } else {
    container['count()'] = undefined;
    container['sum(span.duration)'] = undefined;
    container['avg(span.duration)'] = undefined;
    container['failure_rate()'] = undefined;
  }
  container['p95(span.duration)'] = undefined;
  container['performance_score(measurements.score.total)'] = undefined;

  if (container.type === 'file' && subtreeHasPageload && currentTotalPageloadCount > 0) {
    container.avgPageloadLcp = currentSumPageloadLcp / currentTotalPageloadCount;
    container.avgPageloadPerfScore =
      currentSumPageloadPerfScore / currentTotalPageloadCount;
    container.avgPageloadFailureRate =
      currentSumPageloadWeightedFailureRate / currentTotalPageloadCount;
    container.totalPageloadCount = currentTotalPageloadCount;
  } else if (container.type === 'file') {
    container.avgPageloadLcp = undefined;
    container.avgPageloadPerfScore = undefined;
    container.avgPageloadFailureRate = undefined;
    container.totalPageloadCount = undefined;
  }

  const visibleChildren = container.children
    ? container.children.filter(c => !(c.type === 'folder' && c.name === 'transactions'))
    : [];

  container.hasSingleVisibleChildNamedComponent = false;
  container.isSingleComponentContainer = false;
  container.inlinedComponentName = undefined;
  container.inlinedComponentAvgSsrDuration = undefined;
  container.inlinedComponentCount = undefined;
  container.inlinedComponentDescription = undefined;

  if (visibleChildren.length === 1 && visibleChildren[0]?.type === 'component') {
    const singleComponent = visibleChildren[0];

    container.inlinedComponentName = singleComponent.name;
    container.inlinedComponentAvgSsrDuration = singleComponent['avg(span.duration)'];
    container.inlinedComponentCount = singleComponent['count()'];
    container.inlinedComponentDescription = singleComponent['span.description'];

    if (
      container.type === 'file' &&
      container.name === 'page' &&
      singleComponent.name === 'Component'
    ) {
      container.hasSingleVisibleChildNamedComponent = true;
    } else {
      container.isSingleComponentContainer = true;
    }
  }

  return {
    count: currentAggCount,
    sumDuration: currentAggSumDuration,
    weightedFailureRateSum: currentAggWeightedFailureRateSum,
    foundPageload: subtreeHasPageload,
    pageloadCount: currentTotalPageloadCount,
    pageloadSumLcp: currentSumPageloadLcp,
    pageloadSumPerfScore: currentSumPageloadPerfScore,
    pageloadWeightedFailureRateSum: currentSumPageloadWeightedFailureRate,
  };
}

// Wrapper function to start the aggregation
function aggregateTreeMetrics(rootNode: TreeContainer): void {
  aggregateTreeMetricsRecursive(rootNode);
}

function filterTree(
  tree: TreeContainer,
  path: string[],
  filter: (item: TreeNode, path: string[]) => boolean
): TreeContainer {
  const currentPath = [...path, tree.name];
  const newChildren: TreeNode[] = [];

  for (const child of tree.children) {
    const childPath = [...currentPath, child.name];
    const shouldKeep = filter(child, childPath);

    if (child.type === 'folder' || child.type === 'file') {
      const filteredChild = filterTree(child, currentPath, filter);
      if (filteredChild.children.length > 0 || shouldKeep) {
        newChildren.push(filteredChild);
      }
    } else if (shouldKeep) {
      newChildren.push(child);
    }
  }

  return {...tree, children: newChildren};
}

export default function SSRTreeWidget() {
  const organization = useOrganization();
  const {query} = useTransactionNameQuery();
  const pageFilterChartParams = usePageFilterChartParams({
    granularity: 'spans',
  });
  const {openDrawer} = useDrawer();

  const fullQuery = `span.op:function.nextjs ${query}`;

  const treeRequest = useApiQuery<TreeResponse>(
    [
      `/organizations/${organization.slug}/insights/tree/`,
      {
        query: {
          ...pageFilterChartParams,
          interval: undefined,
          noPagination: true,
          useRpc: true,
          dataset: 'spans',
          query: fullQuery,
          field: ['span.description', 'avg(span.duration)', 'count()'],
        },
      },
    ],
    {staleTime: 0}
  );

  const pageloadRequest = useApiQuery<EventsStats>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          ...pageFilterChartParams,
          statsPeriod:
            pageFilterChartParams.statsPeriod ??
            (pageFilterChartParams.start && pageFilterChartParams.end
              ? `${pageFilterChartParams.start}:${pageFilterChartParams.end}`
              : undefined),
          interval: undefined,
          dataset: 'spans',
          query: `span.op:[pageload,navigation] ${query}`,
          field: [
            'transaction',
            'count()',
            'failure_rate()',
            'sum(measurements.lcp)',
            'avg(measurements.lcp)',
            'p95(span.duration)',
            'performance_score(measurements.score.total)',
            'project.id',
          ],
        },
      },
    ],
    {staleTime: 0}
  );

  const treeData = treeRequest.data?.data ?? [];
  const pageloadRawData =
    (pageloadRequest.data?.data as unknown as TreeResponseItem[]) ?? [];
  const hasData = treeData.length > 0 || pageloadRawData.length > 0;

  const tree = mapResponseToTree(treeData, pageloadRawData);
  if (hasData) {
    aggregateTreeMetrics(tree);
  }

  const visualization = (
    <WidgetVisualizationStates
      isEmpty={!hasData}
      isLoading={treeRequest.isLoading}
      error={treeRequest.error}
      VisualizationType={TreeWidgetVisualization}
      visualizationProps={{tree, size: 'xs'}}
    />
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={WIDGET_TITLE} />}
      Visualization={
        <VisualizationWrapper hide={!hasData}>{visualization}</VisualizationWrapper>
      }
      noVisualizationPadding
      revealActions="always"
      Actions={
        hasData && (
          <Button
            size="xs"
            onClick={() =>
              openDrawer(() => <SSRTreeDrawer tree={tree} />, {
                ariaLabel: WIDGET_TITLE,
                drawerKey: 'ssr-tree-widget',
                drawerWidth: '600px',
                resizable: true,
                shouldCloseOnInteractOutside: element => {
                  return !element.closest(`.${HOVERCARD_BODY_CLASS_NAME}`);
                },
                drawerCss: css`
                  display: flex;
                  flex-direction: column;
                  height: 100%;
                `,
              })
            }
          >
            {t('View All')}
          </Button>
        )
      }
    />
  );
}

function SSRTreeDrawer({tree}: {tree: TreeContainer}) {
  const [search, setSearch] = useState('');

  const filteredTree = useMemo(() => {
    return filterTree(tree, [], (_item, path) => {
      const normalizedSearch = search
        .toLowerCase()
        .split(/[\\/\s]/)
        .join();
      const combinedPath = path.join().toLowerCase();
      return combinedPath.includes(normalizedSearch);
    });
  }, [tree, search]);

  return (
    <Fragment>
      <DrawerHeader>{WIDGET_TITLE}</DrawerHeader>
      <StyledDrawerBody>
        <DrawerHeading>{WIDGET_TITLE}</DrawerHeading>
        <InputGroup>
          <InputGroup.LeadingItems disablePointerEvents>
            <IconSearch size="sm" />
          </InputGroup.LeadingItems>
          <InputGroup.Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('Search for a file or folder')}
          />
        </InputGroup>
        <FlexGrow>
          <DrawerPanel>
            <TreeWidgetVisualization tree={filteredTree} />
            {filteredTree.children.length === 0 && (
              <EmptyMessage size="large" icon={<IconSearch size="lg" />}>
                {t('No results found')}
              </EmptyMessage>
            )}
          </DrawerPanel>
        </FlexGrow>
      </StyledDrawerBody>
    </Fragment>
  );
}

function sortTreeChildren(a: TreeNode, b: TreeNode): number {
  const aCount = a['count()'];
  const bCount = b['count()'];

  if (typeof aCount === 'number' && typeof bCount === 'number') {
    if (aCount !== bCount) {
      return bCount - aCount;
    }
  } else if (typeof aCount === 'number') {
    return -1;
  } else if (typeof bCount === 'number') {
    return 1;
  }

  const isAContainer = a.type === 'folder' || a.type === 'file';
  const isBContainer = b.type === 'folder' || b.type === 'file';

  if (isAContainer && !isBContainer) {
    return -1;
  }
  if (!isAContainer && isBContainer) {
    return 1;
  }

  return a.name.localeCompare(b.name);
}

function TreeWidgetVisualization({
  tree,
  size = 'sm',
}: {
  tree: TreeContainer;
  size?: 'xs' | 'sm';
}) {
  return (
    <TreeGrid size={size}>
      <HeaderCell>{t('Path')}</HeaderCell>
      <HeaderCell>{t('Avg SSR')}</HeaderCell>
      <HeaderCell>{t('Avg LCP')}</HeaderCell>
      <HeaderCell>{t('Failure Rate')}</HeaderCell>
      <HeaderCell>{t('Perf Score')}</HeaderCell>
      <HeaderCell>{t('Count')}</HeaderCell>
      {tree.children.toSorted(sortTreeChildren).map(item => {
        const itemFullPath = [tree.name, item.name].join('/');
        return <TreeNodeRenderer key={itemFullPath} item={item} path={[tree.name]} />;
      })}
    </TreeGrid>
  );
}

function TreeNodeRenderer({
  item,
  indent = 0,
  path = [],
}: {
  item: TreeNode;
  indent?: number;
  path?: string[];
}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const theme = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const itemPath = [...path, item.name];

  let exploreLink: string | null = null;
  if (item.type === 'component' || item.type === 'pageload') {
    exploreLink = getExploreUrl({
      organization,
      selection,
      mode: Mode.SAMPLES,
      visualize: [
        {
          chartType: ChartType.LINE,
          yAxes: ['avg(span.duration)'],
        },
      ],
      query:
        item.type === 'component'
          ? `span.description:"${item['span.description']}"`
          : item.type === 'pageload' && item.transaction
            ? `transaction:"${item.transaction}"`
            : `transaction:"GET /${path.join('/')}" span.op:function.nextjs`,
    });
  }

  if (item.type === 'component') {
    const componentSsrDuration = item['avg(span.duration)'];

    const valueColor =
      typeof componentSsrDuration === 'number' && componentSsrDuration > 500
        ? theme.errorText
        : typeof componentSsrDuration === 'number' && componentSsrDuration > 200
          ? theme.warningText
          : undefined;

    return (
      <Fragment>
        <div>
          <PathWrapper style={{paddingLeft: indent * 18}}>
            <IconCode color="subText" size="xs" />
            <TextOverflow>
              {exploreLink ? <Link to={exploreLink}>{item.name}</Link> : item.name}
            </TextOverflow>
          </PathWrapper>
        </div>
        {typeof componentSsrDuration === 'number' ? (
          <Value style={{color: valueColor}}>
            {getDuration(componentSsrDuration / 1000, 2, true, true)}
          </Value>
        ) : (
          <Value />
        )}
        <Value />
        <Value>{/* Failure Rate placeholder */ ''}</Value>
        <Value>{/* Perf Score placeholder */ ''}</Value>
        <Value>{formatAbbreviatedNumber(item['count()'])}</Value>
      </Fragment>
    );
  }

  if (item.type === 'pageload') {
    const pageloadLcp = item.avgLcp;
    const apiFailureRate = item['failure_rate()'];
    const perfScore = item['performance_score(measurements.score.total)'];

    const lcpColor =
      typeof pageloadLcp === 'number' && pageloadLcp > 4000
        ? theme.errorText
        : typeof pageloadLcp === 'number' && pageloadLcp > 2500
          ? theme.warningText
          : undefined;

    const failureRateForDisplay = apiFailureRate === null ? 0 : apiFailureRate;
    const failureRateColor =
      apiFailureRate && apiFailureRate > 0.1
        ? theme.errorText
        : apiFailureRate && apiFailureRate > 0.05
          ? theme.warningText
          : undefined;

    return (
      <Fragment>
        <div>
          <PathWrapper style={{paddingLeft: indent * 18}}>
            <IconFile color="subText" size="xs" />
            <TextOverflow>
              {exploreLink ? <Link to={exploreLink}>{item.name}</Link> : item.name}
            </TextOverflow>
          </PathWrapper>
        </div>
        <Value />
        {typeof pageloadLcp === 'number' ? (
          <Value style={{color: lcpColor}}>
            {getDuration(pageloadLcp / 1000, 2, true, true)}
          </Value>
        ) : (
          <Value />
        )}
        {typeof apiFailureRate === 'number' || apiFailureRate === null ? (
          <Value style={{color: failureRateColor}}>
            {formatPercentage(failureRateForDisplay as number)}
          </Value>
        ) : (
          <Value />
        )}
        {typeof perfScore === 'number' ? (
          <Value>
            <PerformanceBadge score={Math.round(perfScore * 100)} />
          </Value>
        ) : (
          <Value />
        )}
        <Value>{formatAbbreviatedNumber(item['count()'])}</Value>
      </Fragment>
    );
  }

  const containerItem = item as TreeContainer;

  return (
    <Fragment>
      <div>
        <PathWrapper style={{paddingLeft: indent * 18}}>
          {!(
            containerItem.isSingleComponentContainer ||
            containerItem.hasSingleVisibleChildNamedComponent
          ) && (
            <StyledIconChevron
              onClick={() => setIsCollapsed(!isCollapsed)}
              direction={isCollapsed ? 'right' : 'down'}
            />
          )}
          {(containerItem.isSingleComponentContainer ||
            containerItem.hasSingleVisibleChildNamedComponent) && (
            <span style={{width: '10px', display: 'inline-block'}} />
          )}
          {containerItem.type === 'file' ? (
            <IconFile color="subText" size="xs" />
          ) : (
            <IconProject color="subText" size="xs" />
          )}
          <ClassNames>
            {({css: className}) => (
              <Hovercard
                bodyClassName={HOVERCARD_BODY_CLASS_NAME}
                containerClassName={className`
                  min-width: 0;
                `}
                className={className`
                  width: min-content;
                  max-width: 90vw;
                  min-width: 0;
                `}
                showUnderline={!exploreLink}
                body={
                  <OneLineCodeBlock>
                    <code>{`${itemPath.join('/')}`}</code>
                    <Button
                      size="zero"
                      borderless
                      icon={<IconCopy size="xs" />}
                      aria-label={t('Copy')}
                      onClick={() => {
                        navigator.clipboard.writeText(itemPath.join('/'));
                        addSuccessMessage(t('Copied to clipboard'));
                      }}
                    />
                  </OneLineCodeBlock>
                }
              >
                <TextOverflow>
                  {containerItem.isSingleComponentContainer &&
                  containerItem.inlinedComponentName ? (
                    exploreLink ? (
                      <Link to={exploreLink}>
                        {containerItem.name} ({containerItem.inlinedComponentName})
                      </Link>
                    ) : (
                      `${containerItem.name} (${containerItem.inlinedComponentName})`
                    )
                  ) : exploreLink ? (
                    <Link to={exploreLink}>{containerItem.name}</Link>
                  ) : (
                    containerItem.name
                  )}
                </TextOverflow>
              </Hovercard>
            )}
          </ClassNames>
        </PathWrapper>
      </div>

      {typeof containerItem.inlinedComponentAvgSsrDuration === 'number' ? (
        <Value
          style={{
            color:
              containerItem.inlinedComponentAvgSsrDuration > 500
                ? theme.errorText
                : containerItem.inlinedComponentAvgSsrDuration > 200
                  ? theme.warningText
                  : undefined,
          }}
        >
          {getDuration(
            containerItem.inlinedComponentAvgSsrDuration / 1000,
            2,
            true,
            true
          )}
        </Value>
      ) : (
        <Value />
      )}

      {containerItem.type === 'file' &&
      typeof containerItem.avgPageloadLcp === 'number' ? (
        <Value>{getDuration(containerItem.avgPageloadLcp / 1000, 2, true, true)}</Value>
      ) : (
        <Value />
      )}

      {containerItem.type === 'file' &&
      typeof containerItem.avgPageloadFailureRate === 'number' ? (
        <Value
          style={{
            color:
              containerItem.avgPageloadFailureRate > 0.1
                ? theme.errorText
                : containerItem.avgPageloadFailureRate > 0.05
                  ? theme.warningText
                  : undefined,
          }}
        >
          {formatPercentage(containerItem.avgPageloadFailureRate)}
        </Value>
      ) : (
        <Value />
      )}

      {containerItem.type === 'file' &&
      typeof containerItem.avgPageloadPerfScore === 'number' ? (
        <Value>
          <PerformanceBadge
            score={Math.round(containerItem.avgPageloadPerfScore * 100)}
          />
        </Value>
      ) : (
        <Value />
      )}

      {typeof containerItem.inlinedComponentCount === 'number' ? (
        <Value>{formatAbbreviatedNumber(containerItem.inlinedComponentCount)}</Value>
      ) : containerItem.type === 'file' &&
        typeof containerItem.totalPageloadCount === 'number' ? (
        <Value>{formatAbbreviatedNumber(containerItem.totalPageloadCount)}</Value>
      ) : (
        <Value />
      )}

      {!containerItem.isSingleComponentContainer &&
        !isCollapsed &&
        'children' in containerItem &&
        containerItem.children.toSorted(sortTreeChildren).map((child: TreeNode) => {
          if (child.type === 'folder' && child.name === 'transactions') {
            return null;
          }

          if (
            containerItem.hasSingleVisibleChildNamedComponent &&
            child.type === 'component' &&
            child.name === 'Component'
          ) {
            return null;
          }

          const childFullPath = [...itemPath, child.name].join('/');
          return (
            <TreeNodeRenderer
              key={childFullPath}
              item={child}
              indent={indent + 1}
              path={itemPath}
            />
          );
        })}
    </Fragment>
  );
}

TreeWidgetVisualization.LoadingPlaceholder =
  TimeSeriesWidgetVisualization.LoadingPlaceholder;

const VisualizationWrapper = styled('div')<{hide: boolean}>`
  margin-top: ${space(1)};
  border-top: 1px solid ${p => p.theme.innerBorder};
  overflow-y: auto;
  border-bottom-left-radius: ${p => p.theme.borderRadius};
  border-bottom-right-radius: ${p => p.theme.borderRadius};
  ${p =>
    p.hide &&
    css`
      display: contents;
    `}
`;

const HeaderCell = styled('div')`
  padding: ${space(0.5)};
  text-transform: uppercase;
  font-weight: 600;
  color: ${p => p.theme.subText};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 1;
`;

const PathWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};

  & > svg {
    flex-shrink: 0;
  }
`;

const StyledIconChevron = styled(IconChevron)`
  color: ${p => p.theme.subText};
  cursor: pointer;
  user-select: none;
  width: 10px;
  height: 10px;
`;

const OneLineCodeBlock = styled('pre')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${p => p.theme.codeFontSize};
  font-family: ${p => p.theme.text.familyMono};
  gap: ${space(0.5)};
  padding: ${space(0.5)} ${space(1)};
  margin: 0;
  width: max-content;
  max-width: 100%;
`;

const TreeGrid = styled('div')<{size: 'xs' | 'sm'}>`
  display: grid;
  grid-template-columns: 1fr repeat(5, min-content);
  font-size: ${p => (p.size === 'xs' ? p.theme.fontSizeSmall : p.theme.fontSizeMedium)};

  & > * {
    padding: ${p => (p.size === 'xs' ? space(0.5) : space(0.75))};
    background-color: ${p => p.theme.background};
  }

  & > *:nth-child(6n + 1) {
    text-align: left;
    padding-left: ${space(2)};
    min-width: 0;
  }

  & > *:nth-child(6n + 2),
  & > *:nth-child(6n + 3),
  & > *:nth-child(6n + 4),
  & > *:nth-child(6n + 5),
  & > *:nth-child(6n + 6) {
    text-align: right;
    padding-right: ${space(2)};
  }

  & > *:nth-child(12n + 1),
  & > *:nth-child(12n + 2),
  & > *:nth-child(12n + 3),
  & > *:nth-child(12n + 4),
  & > *:nth-child(12n + 5),
  & > *:nth-child(12n + 6) {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const Value = styled('div')`
  text-align: right;
`;

const StyledDrawerBody = styled(DrawerBody)`
  display: flex;
  flex-direction: column;
  height: 100%;
  flex: 1;
  min-height: 0;
`;

const DrawerPanel = styled(Panel)`
  max-height: 100%;
  overflow-y: auto;
  margin-top: ${space(1)};
`;

const DrawerHeading = styled('h4')`
  margin-bottom: ${space(2)};
`;

const FlexGrow = styled('div')`
  flex: 1;
  min-height: 0;
`;
