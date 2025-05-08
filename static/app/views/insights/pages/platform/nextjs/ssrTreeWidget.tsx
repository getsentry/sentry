import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import Panel from 'sentry/components/panels/panel';
import TextOverflow from 'sentry/components/textOverflow';
import {IconChevron, IconCode, IconFile, IconProject} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventsStats} from 'sentry/types/organization';
import getDuration from 'sentry/utils/duration/getDuration';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/platform/laravel/utils';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';

interface TreeResponseItem {
  'avg(span.duration)': number;
  'function.nextjs.component_type': string;
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
  type: 'component';
}

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

    const {file, functionName} = getFileAndFunctionName(
      item['function.nextjs.component_type']
    );

    const fullPath = [...path];
    if (file) {
      fullPath.push(file);
    }

    // Iterate over the path segments and create folders if they don't exist yet
    for (const segment of fullPath) {
      const decodedSegment = decodeURIComponent(segment);
      const child = currentFolder.children.find(c => c.name === decodedSegment);
      if (child) {
        currentFolder = child as TreeContainer;
      } else {
        const newFolder: TreeContainer = {
          children: [],
          name: decodedSegment,
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
    });
  }

  return root;
}

export default function SSRTreeWidget() {
  const location = useLocation();
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams({
    granularity: 'spans',
  });

  const fullQuery = `span.op:function.nextjs ${location.query.query ?? ''}`;

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
      visualizationProps={{tree}}
    />
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('File Tree')} />}
      Visualization={<VisualizationWrapper>{visualization}</VisualizationWrapper>}
      noVisualizationPadding
      revealActions="always"
      Actions={
        hasData && (
          <Button
            size="xs"
            onClick={() =>
              openInsightChartModal({
                title: t('File Tree'),
                children: <ModalPanel>{visualization}</ModalPanel>,
              })
            }
          >
            {t('Show All')}
          </Button>
        )
      }
    />
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
      <HeaderCell>{t('Avg Duration')}</HeaderCell>
      {tree.children.toSorted(sortTreeChildren).map((item, index) => {
        return <TreeNodeRenderer key={index} item={item} />;
      })}
    </TreeGrid>
  );
}

function TreeNodeRenderer({item, indent = 0}: {item: TreeNode; indent?: number}) {
  const theme = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);

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
            <TextOverflow>{item.name}</TextOverflow>
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
          <TextOverflow>{item.name}</TextOverflow>
        </PathWrapper>
      </div>
      <div>{'–'}</div>
      {!isCollapsed &&
        item.children
          .toSorted(sortTreeChildren)
          .map((child, index) => (
            <TreeNodeRenderer key={index} item={child} indent={indent + 1} />
          ))}
    </Fragment>
  );
}

TreeWidgetVisualization.LoadingPlaceholder =
  TimeSeriesWidgetVisualization.LoadingPlaceholder;

const VisualizationWrapper = styled('div')`
  margin-top: ${space(1)};
  border-top: 1px solid ${p => p.theme.innerBorder};
  overflow-y: auto;
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

const TreeGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr min-content;
  font-size: ${p => p.theme.codeFontSize};

  & > * {
    padding: ${space(0.25)};
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

const ModalPanel = styled(Panel)`
  max-height: min(50vh, 500px);
  overflow-y: auto;
`;
