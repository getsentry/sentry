import {Fragment, useMemo, useState} from 'react';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';
import {IconChevron} from '@sentry/icons/chevron';
import {IconCode} from '@sentry/icons/code';
import {IconCopy} from '@sentry/icons/copy';
import {IconFile} from '@sentry/icons/file';
import {IconProject} from '@sentry/icons/project';
import {IconSearch} from '@sentry/icons/search';

import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import type {TableColumnConfig} from '@sentry/scraps/table';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {EmptyMessage} from 'sentry/components/emptyMessage';
import {Hovercard} from 'sentry/components/hovercard';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TextOverflow} from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
import type {EventsStats} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/platform/laravel/utils';
import {DurationCell} from 'sentry/views/insights/pages/platform/shared/table/DurationCell';
import {ErrorRateCell} from 'sentry/views/insights/pages/platform/shared/table/ErrorRateCell';

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

const COLUMNS: TableColumnConfig[] = [
  {key: 'path', width: 'minmax(0, 1fr)'},
  {key: 'errorRate', width: 'max-content'},
  {key: 'avg', width: 'max-content'},
  {key: 'p95', width: 'max-content'},
];

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
    let currentFolder = root;

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

export function BaseServerTree({query}: {query?: string}) {
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams();

  let finalQuery = 'span.op:function.nextjs';
  if (query) {
    finalQuery += ` ${query}`;
  }

  const treeRequest = useApiQuery<TreeResponse>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/insights/tree/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          ...pageFilterChartParams,
          interval: undefined,
          noPagination: true,
          useRpc: true,
          dataset: 'spans',
          query: finalQuery,
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
    <FlushTable columns={COLUMNS} customSections scrollable>
      <SimpleTable.Head sticky>
        <SimpleTable.HeaderRow>
          <SimpleTable.HeaderCell>{t('Path')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell align="right">{t('Error Rate')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell align="right">{t('Avg')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell align="right">{t('P95')}</SimpleTable.HeaderCell>
        </SimpleTable.HeaderRow>
      </SimpleTable.Head>
      <SimpleTable.Body>
        {treeRequest.isLoading ? (
          <SimpleTable.Loading />
        ) : hasData ? (
          tree.children
            .toSorted(sortTreeChildren)
            .map((item, index) => <TreeNodeRenderer key={index} item={item} />)
        ) : (
          <SimpleTable.Empty>
            <EmptyMessage size="lg" icon={<IconSearch />}>
              {t('No results found')}
            </EmptyMessage>
          </SimpleTable.Empty>
        )}
      </SimpleTable.Body>
    </FlushTable>
  );
}

function sortTreeChildren(a: TreeNode, b: TreeNode): number {
  if (a.type === 'folder' && b.type === 'component') {
    return -1;
  }

  return a.name.localeCompare(b.name);
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
      <SimpleTable.Row>
        <SimpleTable.RowCell>
          <Flex align="center" gap="xs" minWidth={0} style={{paddingLeft: indent * 18}}>
            <Container flexShrink={0} width="24px" height="24px" />
            <IconCode variant="muted" size="xs" />
            <TextOverflow>
              {exploreLink ? <Link to={exploreLink}>{item.name}</Link> : item.name}
            </TextOverflow>
          </Flex>
        </SimpleTable.RowCell>
        <SimpleTable.RowCell justify="end">
          <ErrorRateCell errorRate={item['failure_rate()']} total={item['count()']} />
        </SimpleTable.RowCell>
        <SimpleTable.RowCell justify="end">
          <DurationCell milliseconds={item['avg(span.duration)']} />
        </SimpleTable.RowCell>
        <SimpleTable.RowCell justify="end">
          <DurationCell
            milliseconds={item['p95(span.duration)']}
            thresholds={getP95Threshold(item['avg(span.duration)'])}
          />
        </SimpleTable.RowCell>
      </SimpleTable.Row>
    );
  }

  return (
    <Fragment>
      <SimpleTable.Row>
        <SimpleTable.RowCell>
          <Flex align="center" gap="xs" minWidth={0} style={{paddingLeft: indent * 18}}>
            <Button
              size="zero"
              variant="transparent"
              aria-expanded={!isCollapsed}
              aria-label={
                isCollapsed
                  ? t('Expand %s', itemPath.join('/'))
                  : t('Collapse %s', itemPath.join('/'))
              }
              icon={
                <IconChevron
                  variant="muted"
                  size="xs"
                  direction={isCollapsed ? 'right' : 'down'}
                />
              }
              onClick={() => setIsCollapsed(!isCollapsed)}
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
                      <code>{itemPath.join('/')}</code>
                      <Button
                        size="zero"
                        variant="transparent"
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
          </Flex>
        </SimpleTable.RowCell>
        <SimpleTable.RowCell />
        <SimpleTable.RowCell />
        <SimpleTable.RowCell />
      </SimpleTable.Row>
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

const FlushTable = styled(SimpleTable)`
  border-width: 1px 0 0;
  border-radius: 0;
  margin-top: ${p => p.theme.space.lg};

  > thead > tr {
    border-radius: 0;
  }
`;

const OneLineCodeBlock = styled('pre')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${p => p.theme.font.size.sm};
  font-family: ${p => p.theme.font.family.mono};
  gap: ${p => p.theme.space.xs};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  margin: 0;
  width: max-content;
  max-width: 100%;
`;
