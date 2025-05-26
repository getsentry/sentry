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
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/platform/laravel/utils';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';

interface TreeResponseItem {
  'avg(span.duration)': number;
  'function.nextjs.component_type': string | null;
  'function.nextjs.path': string[];
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
}

interface TreeLeaf {
  'avg(span.duration)': number;
  name: string;
  'span.description': string;
  type: 'component';
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
      'span.description': item['span.description'],
    });
  }

  return root;
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
          field: ['span.description', 'avg(span.duration)'],
        },
      },
    ],
    {staleTime: 0}
  );

  const treeData = treeRequest.data?.data ?? [];
  const hasData = treeData.length > 0;

  const tree = mapResponseToTree(treeData);

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
  if (a.type === 'folder' && b.type === 'component') {
    return -1;
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
      <HeaderCell>{t('Avg Duration')}</HeaderCell>
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
  const theme = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const itemPath = [...path, item.name];

  let exploreLink: string | null = null;
  if (item.type !== 'folder') {
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
        <div style={{color: valueColor}}>
          {getDuration(durationMs / 1000, 2, true, true)}
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
      <div />
      {!isCollapsed &&
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
  grid-template-columns: 1fr min-content;
  font-size: ${p => (p.size === 'xs' ? p.theme.fontSizeSmall : p.theme.fontSizeMedium)};

  & > * {
    padding: ${p => (p.size === 'xs' ? space(0.5) : space(0.75))};
    background-color: ${p => p.theme.background};
  }

  & > *:nth-child(2n + 1) {
    text-align: left;
    padding-left: ${space(2)};
    min-width: 0;
  }

  & > *:nth-child(2n) {
    text-align: right;
    padding-right: ${space(2)};
  }

  & > *:nth-child(4n + 1),
  & > *:nth-child(4n + 2) {
    background-color: ${p => p.theme.backgroundSecondary};
  }
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
