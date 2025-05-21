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
  'avg(span.duration)': number;
  'count()': number;
  'function.nextjs.component_type': string;
  'function.nextjs.path': string[];
  'span.description': string;
  // Optional fields (sorted alphabetically)
  'failure_rate()'?: number;
  'p95(span.duration)'?: number;
  'performance_score(measurements.score.total)'?: number;
  'project.id'?: number;
  'span.op'?: string;
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
  // Aggregated metrics
  'avg(span.duration)'?: number;
  // Page-level aggregated metrics from pageloads
  avgPageloadDuration?: number;
  avgPageloadPerfScore?: number;
  'count()'?: number;
  'failure_rate()'?: number;
  hasPageloadDescendant?: boolean;
  'p95(span.duration)'?: number;
  'performance_score(measurements.score.total)'?: number;
  'sum(span.duration)'?: number;
  totalPageloadCount?: number;
}

interface TreeLeaf {
  'avg(span.duration)': number;
  'count()': number;
  name: string;
  'span.description': string;
  type: 'component' | 'pageload';
  'failure_rate()'?: number;
  'p95(span.duration)'?: number;
  'performance_score(measurements.score.total)'?: number;
  'project.id'?: number;
  'sum(span.duration)'?: number;
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
    });
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
        } else {
          pagesFolder.children.push({
            name: transactionName,
            type: 'pageload',
            'avg(span.duration)': item['avg(span.duration)'],
            'count()': item['count()'],
            'span.description': transactionName,
            transaction: item.transaction,
            'failure_rate()': item['failure_rate()'],
            'p95(span.duration)': item['p95(span.duration)'],
            'performance_score(measurements.score.total)':
              item['performance_score(measurements.score.total)'],
            'project.id': item['project.id'],
            'sum(span.duration)': item['sum(span.duration)'],
          });
        }
      }
    }
  }

  return root;
}

// Helper function to recursively aggregate metrics up the tree
interface AggregationResult {
  count: number;
  // Sum of (failure_rate() * count()) for all descendants
  foundPageload: boolean;
  // For pageload-specific aggregations needed at file level
  pageloadCount: number;
  pageloadSumAvgDuration: number;

  // Sum of (avg(span.duration) * count()) for pageloads
  pageloadSumPerfScore: number;
  // Sum of count() for all descendants (components + pageloads)
  sumDuration: number;
  // Sum of (avg(span.duration) * count()) for all descendants
  weightedFailureRateSum: number; // Sum of (performance_score * count()) for pageloads
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
      return {
        count,
        sumDuration,
        weightedFailureRateSum: weightedFR,
        foundPageload: true,
        pageloadCount: count,
        pageloadSumAvgDuration: (leaf['avg(span.duration)'] ?? 0) * count,
        pageloadSumPerfScore:
          (typeof pageloadPerfScore === 'number' ? pageloadPerfScore : 0) * count,
      };
    }

    // It's a component
    return {
      count,
      sumDuration,
      weightedFailureRateSum: weightedFR,
      foundPageload: false,
      pageloadCount: 0,
      pageloadSumAvgDuration: 0,
      pageloadSumPerfScore: 0,
    };
  }

  // It's a TreeContainer
  const container = node as TreeContainer;
  let currentAggCount = 0;
  let currentAggSumDuration = 0;
  let currentAggWeightedFailureRateSum = 0;
  let subtreeHasPageload = false;

  let currentTotalPageloadCount = 0;
  let currentSumPageloadAvgDuration = 0;
  let currentSumPageloadPerfScore = 0;

  if (container.children) {
    for (const child of container.children) {
      const childAggregates = aggregateTreeMetricsRecursive(child);
      currentAggCount += childAggregates.count;
      currentAggSumDuration += childAggregates.sumDuration;
      currentAggWeightedFailureRateSum += childAggregates.weightedFailureRateSum;

      currentTotalPageloadCount += childAggregates.pageloadCount;
      currentSumPageloadAvgDuration += childAggregates.pageloadSumAvgDuration;
      currentSumPageloadPerfScore += childAggregates.pageloadSumPerfScore;

      if (childAggregates.foundPageload) {
        subtreeHasPageload = true;
      }
    }
  }

  container.hasPageloadDescendant = subtreeHasPageload;

  // Clear generic aggregates for all containers first, or set if pageload descendant
  // These were previously hidden by '—' in renderer, this logic is for data integrity.
  if (subtreeHasPageload) {
    container['count()'] = currentAggCount; // Overall count
    container['sum(span.duration)'] = currentAggSumDuration;
    if (currentAggCount > 0) {
      container['avg(span.duration)'] = currentAggSumDuration / currentAggCount;
      container['failure_rate()'] = currentAggWeightedFailureRateSum / currentAggCount;
    } else {
      container['avg(span.duration)'] = 0;
      container['failure_rate()'] = 0;
    }
    // P95 and Perf Score remain undefined at generic container level as they are not aggregated this way.
    container['p95(span.duration)'] = undefined;
    container['performance_score(measurements.score.total)'] = undefined;
  } else {
    container['count()'] = undefined;
    container['sum(span.duration)'] = undefined;
    container['avg(span.duration)'] = undefined;
    container['failure_rate()'] = undefined;
    container['p95(span.duration)'] = undefined;
    container['performance_score(measurements.score.total)'] = undefined;
  }

  // Specifically for 'file' type containers, calculate and set pageload aggregates
  if (container.type === 'file' && subtreeHasPageload && currentTotalPageloadCount > 0) {
    container.avgPageloadDuration =
      currentSumPageloadAvgDuration / currentTotalPageloadCount;
    container.avgPageloadPerfScore =
      currentSumPageloadPerfScore / currentTotalPageloadCount;
    container.totalPageloadCount = currentTotalPageloadCount;
  } else if (container.type === 'file') {
    // Clear them if no pageloads or count is zero
    container.avgPageloadDuration = undefined;
    container.avgPageloadPerfScore = undefined;
    container.totalPageloadCount = undefined;
  }

  return {
    count: currentAggCount,
    sumDuration: currentAggSumDuration,
    weightedFailureRateSum: currentAggWeightedFailureRateSum,
    foundPageload: subtreeHasPageload,
    pageloadCount: currentTotalPageloadCount,
    pageloadSumAvgDuration: currentSumPageloadAvgDuration,
    pageloadSumPerfScore: currentSumPageloadPerfScore,
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
            'sum(span.duration)',
            'avg(span.duration)',
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
    aggregateTreeMetrics(tree); // Aggregate metrics after tree is built
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
      // Split the search string by separators (/, \ and space)
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

  // Primary sort: by count descending
  if (typeof aCount === 'number' && typeof bCount === 'number') {
    if (aCount !== bCount) {
      return bCount - aCount; // Higher count comes first
    }
  } else if (typeof aCount === 'number') {
    return -1; // 'a' has count, 'b' doesn't, so 'a' comes first
  } else if (typeof bCount === 'number') {
    return 1; // 'b' has count, 'a' doesn't, so 'b' comes first
  }
  // If counts are equal or both are undefined, proceed to secondary sorting criteria

  const isAContainer = a.type === 'folder' || a.type === 'file';
  const isBContainer = b.type === 'folder' || b.type === 'file';

  // Secondary sort: containers (folders/files) before leafs (components/pageloads)
  if (isAContainer && !isBContainer) {
    return -1; // 'a' is container, 'b' is leaf, so 'a' comes first
  }
  if (!isAContainer && isBContainer) {
    return 1; // 'b' is container, 'a' is leaf, so 'b' comes first
  }

  // Tertiary sort: if both are containers or both are leafs (or same specific type), sort by name
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
      <HeaderCell>{t('Avg Duration')}</HeaderCell>
      <HeaderCell>{t('P95 Duration')}</HeaderCell>
      <HeaderCell>{t('Failure Rate')}</HeaderCell>
      <HeaderCell>{t('Perf Score')}</HeaderCell>
      <HeaderCell>{t('Count')}</HeaderCell>
      {tree.children.toSorted(sortTreeChildren).map(item => {
        // Path for top-level items, assuming tree.name is 'root' or similar unique identifier for the base path
        const itemFullPath = [tree.name, item.name].join('/');
        return (
          <TreeNodeRenderer
            key={itemFullPath}
            item={item}
            path={[tree.name]} // Pass the path of the parent (the root tree itself)
          />
        );
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
    const durationMs = item['avg(span.duration)'];

    const valueColor =
      durationMs > 500
        ? theme.errorText
        : durationMs > 200
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
        <Value style={{color: valueColor}}>
          {getDuration(durationMs / 1000, 2, true, true)}
        </Value>
        <Value>{/* P95 placeholder */ ''}</Value>
        <Value>{/* Failure Rate placeholder */ ''}</Value>
        <Value>{/* Perf Score placeholder */ ''}</Value>
        <Value>{formatAbbreviatedNumber(item['count()'])}</Value>
      </Fragment>
    );
  }

  if (item.type === 'pageload') {
    const durationMs = item['avg(span.duration)'];
    const p95Ms = item['p95(span.duration)'];
    const apiFailureRate = item['failure_rate()'];
    const perfScore = item['performance_score(measurements.score.total)'];

    const durationColor =
      durationMs && durationMs > 500
        ? theme.errorText
        : durationMs && durationMs > 200
          ? theme.warningText
          : undefined;
    const p95Color =
      p95Ms && p95Ms > 1000
        ? theme.errorText
        : p95Ms && p95Ms > 400
          ? theme.warningText
          : undefined;
    const failureRateForDisplay = apiFailureRate === null ? 0 : apiFailureRate;
    const failureRateColor =
      apiFailureRate && apiFailureRate > 0.1
        ? theme.errorText
        : apiFailureRate && apiFailureRate > 0.05
          ? theme.warningText
          : undefined;

    // Path cell (transaction name)
    // Avg Duration, P95, Failure Rate, Perf Score cells
    // Count cell
    return (
      <Fragment>
        <div>
          <PathWrapper style={{paddingLeft: indent * 18}}>
            {/* Using IconFile for pageloads, could be different if needed */}
            <IconFile color="subText" size="xs" />
            <TextOverflow>
              {exploreLink ? <Link to={exploreLink}>{item.name}</Link> : item.name}
            </TextOverflow>
          </PathWrapper>
        </div>
        {typeof durationMs === 'number' ? (
          <Value style={{color: durationColor}}>
            {getDuration(durationMs / 1000, 2, true, true)}
          </Value>
        ) : (
          <Value>{'—'}</Value>
        )}
        {typeof p95Ms === 'number' ? (
          <Value style={{color: p95Color}}>
            {getDuration(p95Ms / 1000, 2, true, true)}
          </Value>
        ) : (
          <Value>{'—'}</Value>
        )}
        {typeof apiFailureRate === 'number' || apiFailureRate === null ? (
          <Value style={{color: failureRateColor}}>
            {formatPercentage(failureRateForDisplay as number)}
          </Value>
        ) : (
          <Value>{'—'}</Value>
        )}
        {typeof perfScore === 'number' ? (
          <Value>
            <PerformanceBadge score={Math.round(perfScore * 100)} />
          </Value>
        ) : (
          <Value>{'—'}</Value>
        )}
        <Value>{formatAbbreviatedNumber(item['count()'])}</Value>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <div>
        <PathWrapper style={{paddingLeft: indent * 18}}>
          <StyledIconChevron
            onClick={() => setIsCollapsed(!isCollapsed)}
            direction={isCollapsed ? 'right' : 'down'}
          />
          {item.type === 'file' ? (
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
                  {exploreLink ? <Link to={exploreLink}>{item.name}</Link> : item.name}
                </TextOverflow>
              </Hovercard>
            )}
          </ClassNames>
        </PathWrapper>
      </div>
      {/* Metrics for folder/file rows */}
      {item.type === 'file' && typeof item.avgPageloadDuration === 'number' ? (
        <Value>{getDuration(item.avgPageloadDuration / 1000, 2, true, true)}</Value>
      ) : (
        <Value>{/* Default for folders or if file has no pageload avg */ '—'}</Value>
      )}

      {/* P95 Duration for containers - always '—' for files/folders based on current req */}
      <Value>{'—'}</Value>

      {/* Failure Rate for containers - always '—' for files/folders based on current req */}
      <Value>{'—'}</Value>

      {item.type === 'file' && typeof item.avgPageloadPerfScore === 'number' ? (
        <Value>
          <PerformanceBadge score={Math.round(item.avgPageloadPerfScore * 100)} />
        </Value>
      ) : (
        <Value>
          {/* Default for folders or if file has no pageload perf score */ '—'}
        </Value>
      )}

      {item.type === 'file' && typeof item.totalPageloadCount === 'number' ? (
        <Value>{formatAbbreviatedNumber(item.totalPageloadCount)}</Value>
      ) : (
        <Value>{/* Default for folders or if file has no pageload count */ '—'}</Value>
      )}

      {!isCollapsed &&
        'children' in item && // Type guard for item.children
        item.children.toSorted(sortTreeChildren).map((child: TreeNode) => {
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
