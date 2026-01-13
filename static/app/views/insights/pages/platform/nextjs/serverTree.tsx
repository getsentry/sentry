import {Fragment, useMemo, useState} from 'react';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {Link} from 'sentry/components/core/link';
import EmptyMessage from 'sentry/components/emptyMessage';
import {Hovercard} from 'sentry/components/hovercard';
import LoadingIndicator from 'sentry/components/loadingIndicator';
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
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/platform/laravel/utils';
import {DurationCell} from 'sentry/views/insights/pages/platform/shared/table/DurationCell';
import {ErrorRateCell} from 'sentry/views/insights/pages/platform/shared/table/ErrorRateCell';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';

interface TreeResponseItem {
  'avg(span.duration)': number;
  'count()': number;
  'failure_rate()': number;
  'function.nextjs.component_type': string | null;
  'function.nextjs.path': string[];
  'p95(span.duration)': number;
  'span.description': string;
}

interface TreeResponse extends Omit<EventsStats, 'data'> {
  data: TreeResponseItem[];
}

type TreeNode = TreeContainer | TreeLeaf;

interface TreeContainer {
  children: TreeNode[];
  name: string;
  type: 'folder' | 'file';
  query?: string;
}

interface TreeLeaf {
  'avg(span.duration)': number;
  'count()': number;
  'failure_rate()': number;
  name: string;
  'p95(span.duration)': number;
  query: string;
  'span.description': string;
  type: 'component';
}

const HOVERCARD_BODY_CLASS_NAME = 'ssrTreeHovercard';

const getP95Threshold = (avg: number) => {
  return {
    danger: avg * 3,
    warning: avg * 2,
  };
};

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

export function mapResponseToTree(response: TreeResponseItem[]): TreeContainer {
  const root: TreeContainer = {
    children: [],
    name: 'root',
    type: 'folder',
  };

  // Each item of the response is a component in the tree with a path
  for (const item of response) {
    const path = item['function.nextjs.path'];
    let currentFolder: TreeContainer = root;

    // Custom spans with span.op:function.nextjs will not have a component type and cannot be added to the tree
    const componentType = item['function.nextjs.component_type'];
    if (!componentType) {
      continue;
    }

    const {file, functionName} = getFileAndFunctionName(componentType);

    const currentPath = [];
    const fullPath = [...path];
    if (file) {
      fullPath.push(file);
    }

    // Iterate over the path segments and create folders if they don't exist yet
    for (const segment of fullPath) {
      currentPath.push(segment);
      const child = currentFolder.children.find(c => c.name === segment);
      if (child) {
        currentFolder = child as TreeContainer;
      } else {
        const newFolder: TreeContainer = {
          children: [],
          name: segment,
          type: file === segment ? 'file' : 'folder',
          query:
            file === segment
              ? `transaction:"GET /${currentPath.join('/')}" span.op:function.nextjs`
              : undefined,
        };
        currentFolder.children.push(newFolder);
        currentFolder = newFolder;
      }
    }

    // Add the component to the last folder in the path
    currentFolder.children.push({
      name: functionName,
      type: 'component',
      'count()': item['count()'],
      'avg(span.duration)': item['avg(span.duration)'],
      'span.description': item['span.description'],
      'failure_rate()': item['failure_rate()'],
      'p95(span.duration)': item['p95(span.duration)'],
      query: `span.description:"${item['span.description']}" span.op:function.nextjs`,
    });
  }

  return root;
}

export function ServerTree() {
  const organization = useOrganization();
  const {query} = useTransactionNameQuery();
  const pageFilterChartParams = usePageFilterChartParams();

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
          query: `span.op:function.nextjs ${query}`,
          field: [
            'count()',
            'span.description',
            'failure_rate()',
            'avg(span.duration)',
            'p95(span.duration)',
          ],
        },
      },
    ],
    {staleTime: 0}
  );

  const treeData = useMemo(() => treeRequest.data?.data ?? [], [treeRequest.data]);
  const hasData = treeData.length > 0;

  const tree = useMemo(() => mapResponseToTree(treeData), [treeData]);

  return (
    <StyledPanel>
      <TreeWidgetVisualization tree={tree} />
      {treeRequest.isLoading ? (
        <LoadingIndicator />
      ) : hasData ? null : (
        <EmptyMessage size="lg" icon={<IconSearch />}>
          {t('No results found')}
        </EmptyMessage>
      )}
    </StyledPanel>
  );
}

function sortTreeChildren(a: TreeNode, b: TreeNode): number {
  if (a.type === 'folder' && b.type === 'component') {
    return -1;
  }

  return a.name.localeCompare(b.name);
}

function TreeWidgetVisualization({tree}: {tree: TreeContainer}) {
  return (
    <TreeGrid>
      <HeaderCell>{t('Path')}</HeaderCell>
      <HeaderCell>{t('Error Rate')}</HeaderCell>
      <HeaderCell>{t('AVG')}</HeaderCell>
      <HeaderCell>{t('P95')}</HeaderCell>
      {tree.children.toSorted(sortTreeChildren).map((item, index) => {
        return <TreeNodeRenderer key={index} item={item} />;
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const itemPath = [...path, item.name];

  let exploreLink: string | null = null;
  if (item.query) {
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
      query: item.query,
    });
  }

  if (item.type === 'component') {
    return (
      <Fragment>
        <div>
          <PathWrapper style={{paddingLeft: indent * 18}}>
            <IconCode variant="muted" size="xs" />
            <TextOverflow>
              {exploreLink ? <Link to={exploreLink}>{item.name}</Link> : item.name}
            </TextOverflow>
          </PathWrapper>
        </div>
        <div>
          <ErrorRateCell errorRate={item['failure_rate()']} total={item['count()']} />
        </div>
        <div>
          <DurationCell milliseconds={item['avg(span.duration)']} />
        </div>
        <div>
          <DurationCell
            milliseconds={item['p95(span.duration)']}
            thresholds={getP95Threshold(item['avg(span.duration)'])}
          />
        </div>
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
            <IconFile variant="muted" size="xs" />
          ) : (
            <IconProject variant="muted" size="xs" />
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
      <div />
      <div />
      <div />
      {!isCollapsed &&
        'children' in item &&
        item.children
          .toSorted(sortTreeChildren)
          .map((child, index) => (
            <TreeNodeRenderer
              key={index}
              item={child}
              indent={indent + 1}
              path={itemPath}
            />
          ))}
    </Fragment>
  );
}

const HeaderCell = styled('div')`
  padding: ${space(2)} ${space(0.75)};
  text-transform: uppercase;
  font-weight: 600;
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.sm};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  white-space: nowrap;
  line-height: 1;
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
  color: ${p => p.theme.tokens.content.secondary};
  cursor: pointer;
  user-select: none;
  width: 10px;
  height: 10px;
`;

const OneLineCodeBlock = styled('pre')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${p => p.theme.fontSize.sm};
  font-family: ${p => p.theme.text.familyMono};
  gap: ${space(0.5)};
  padding: ${space(0.5)} ${space(1)};
  margin: 0;
  width: max-content;
  max-width: 100%;
`;

const TreeGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr min-content min-content min-content;
  font-size: ${p => p.theme.fontSize.md};

  & > * {
    text-align: right;
    padding: ${space(0.75)} ${space(1.5)};
    background-color: ${p => p.theme.tokens.background.primary};
    line-height: 1.1;
  }

  & > *:nth-child(4n + 1) {
    text-align: left;
    padding-left: ${space(2)};
    min-width: 0;
  }

  & > *:nth-child(4n) {
    padding-right: ${space(2)};
  }

  & > *:nth-child(8n + 1),
  & > *:nth-child(8n + 2),
  & > *:nth-child(8n + 3),
  & > *:nth-child(8n + 4) {
    background-color: ${p => p.theme.tokens.background.secondary};
  }
`;

const StyledPanel = styled(Panel)`
  max-height: 400px;
  overflow-y: auto;
  margin-top: ${space(1)};
`;
