import type {ReactNode} from 'react';
import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import {PlatformIcon} from 'platformicons';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import type {GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import renderSortableHeaderCell from 'sentry/components/replays/renderSortableHeaderCell';
import useQueryBasedColumnResize from 'sentry/components/replays/useQueryBasedColumnResize';
import useQueryBasedSorting from 'sentry/components/replays/useQueryBasedSorting';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCursorArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {WiderHovercard} from 'sentry/views/insights/common/components/tableCells/spanDescriptionCell';
import type {DeadRageSelectorItem} from 'sentry/views/replays/types';

export interface UrlState {
  widths: string[];
}

export function transformSelectorQuery(selector: string) {
  return selector
    .replaceAll('"', `\\"`)
    .replaceAll('aria=', 'aria-label=')
    .replaceAll('testid=', 'data-test-id=')
    .replaceAll(':', '\\:')
    .replaceAll('*', '\\*');
}
interface Props {
  clickCountColumns: {key: string; name: string}[];
  clickCountSortable: boolean;
  data: DeadRageSelectorItem[];
  isError: boolean;
  isLoading: boolean;
  location: Location<any>;
  title?: ReactNode;
}

const BASE_COLUMNS: GridColumnOrder<string>[] = [
  {key: 'project_id', name: 'project'},
  {key: 'element', name: 'element'},
  {key: 'dom_element', name: 'selector'},
  {key: 'aria_label', name: 'aria label'},
];

export function ProjectInfo({id, isWidget}: {id: number; isWidget: boolean}) {
  const {projects} = useProjects();
  const project = projects.find(p => p.id === id.toString());
  const platform = project?.platform;
  const slug = project?.slug;
  return isWidget ? (
    <WidgetProjectContainer>
      <Tooltip title={slug}>
        <PlatformIcon size={16} platform={platform ?? 'default'} />
      </Tooltip>
    </WidgetProjectContainer>
  ) : (
    <IndexProjectContainer>
      <PlatformIcon size={16} platform={platform ?? 'default'} />
      <TextOverflow>{slug}</TextOverflow>
    </IndexProjectContainer>
  );
}

export default function SelectorTable({
  clickCountColumns,
  data,
  isError,
  isLoading,
  location,
  title,
  clickCountSortable,
}: Props) {
  const {currentSort, makeSortLinkGenerator} = useQueryBasedSorting({
    defaultSort: {field: clickCountColumns[0]!.key, kind: 'desc'},
    location,
  });

  const {columns, handleResizeColumn} = useQueryBasedColumnResize({
    columns: BASE_COLUMNS.concat(clickCountColumns),
    location,
  });

  const renderHeadCell = useMemo(
    () =>
      renderSortableHeaderCell({
        currentSort,
        makeSortLinkGenerator,
        onClick: () => {},
        rightAlignedColumns: [],
        sortableColumns: clickCountSortable ? clickCountColumns : [],
      }),
    [currentSort, makeSortLinkGenerator, clickCountColumns, clickCountSortable]
  );

  const queryPrefix = currentSort.field.includes('count_dead_clicks') ? 'dead' : 'rage';

  const renderBodyCell = useCallback(
    (column, dataRow) => {
      const value = dataRow[column.key];
      switch (column.key) {
        case 'dom_element':
          return (
            <SelectorLink
              value={value.selector}
              selectorQuery={`${queryPrefix}.selector:"${transformSelectorQuery(
                value.fullSelector
              )}"`}
              projectId={value.projectId.toString()}
            />
          );
        case 'element':
        case 'aria_label':
          return <TextOverflow>{value}</TextOverflow>;
        case 'project_id':
          return <ProjectInfo id={value} isWidget={false} />;
        default:
          return renderClickCount<DeadRageSelectorItem>(column, dataRow);
      }
    },
    [queryPrefix]
  );

  const selectorEmptyMessage = (
    <MessageContainer>
      <Title>{t('No dead or rage clicks found')}</Title>
      <Subtitle>
        {t(
          'There were no dead or rage clicks within this timeframe. Expand your timeframe, or increase your replay sample rate to see more data.'
        )}
      </Subtitle>
    </MessageContainer>
  );

  return (
    <GridEditable
      error={isError}
      isLoading={isLoading}
      data={data ?? []}
      columnOrder={columns}
      emptyMessage={selectorEmptyMessage}
      columnSortBy={[]}
      stickyHeader
      grid={{
        onResizeColumn: handleResizeColumn,
        renderHeadCell,
        renderBodyCell,
      }}
      title={title}
    />
  );
}

export function SelectorLink({
  value,
  selectorQuery,
  projectId,
}: {
  projectId: string;
  selectorQuery: string;
  value: string;
}) {
  const organization = useOrganization();
  const location = useLocation();
  const hovercardContent = (
    <TooltipContainer>
      {t('Search for replays with clicks on the element')}
      <SelectorScroll>
        <CodeSnippet hideCopyButton language="javascript">
          {value}
        </CodeSnippet>
      </SelectorScroll>
    </TooltipContainer>
  );

  return (
    <StyledTextOverflow>
      <WiderHovercard position="right" body={hovercardContent}>
        <Link
          to={{
            pathname: normalizeUrl(`/organizations/${organization.slug}/replays/`),
            query: {
              ...location.query,
              query: selectorQuery,
              cursor: undefined,
              project: projectId,
            },
          }}
        >
          <TextOverflow>{value}</TextOverflow>
        </Link>
      </WiderHovercard>
    </StyledTextOverflow>
  );
}

function renderClickCount<T>(column: GridColumnOrder<string>, dataRow: T) {
  const color = column.key === 'count_dead_clicks' ? 'yellow300' : 'red300';

  return (
    <ClickCount>
      <IconCursorArrow size="xs" color={color} />
      {dataRow[column.key]}
    </ClickCount>
  );
}

const ClickCount = styled(TextOverflow)`
  color: ${p => p.theme.gray400};
  display: grid;
  grid-template-columns: auto auto;
  gap: ${space(0.75)};
  align-items: center;
  justify-content: start;
`;

const StyledTextOverflow = styled(TextOverflow)`
  color: ${p => p.theme.blue300};
`;

const TooltipContainer = styled('div')`
  display: grid;
  grid-auto-flow: row;
  gap: ${space(1)};
`;

const SelectorScroll = styled('div')`
  overflow: scroll;
`;

const Subtitle = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Title = styled('div')`
  font-size: 24px;
`;

const MessageContainer = styled('div')`
  display: grid;
  grid-auto-flow: row;
  gap: ${space(1)};
  justify-items: center;
  text-align: center;
  padding: ${space(4)};
`;

const WidgetProjectContainer = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${space(0.75)};
`;

const IndexProjectContainer = styled(WidgetProjectContainer)`
  padding-right: ${space(1)};
`;
