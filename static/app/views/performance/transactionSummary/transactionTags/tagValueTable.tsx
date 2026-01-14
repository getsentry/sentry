import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptorObject} from 'history';

import {Link} from 'sentry/components/core/link';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import PerformanceDuration from 'sentry/components/performanceDuration';
import GridEditable from 'sentry/components/tables/gridEditable';
import SortLink from 'sentry/components/tables/gridEditable/sortLink';
import useStateBasedColumnResize from 'sentry/components/tables/gridEditable/useStateBasedColumnResize';
import {IconAdd} from 'sentry/icons/iconAdd';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import type EventView from 'sentry/utils/discover/eventView';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import type {
  TableData,
  TableDataRow,
} from 'sentry/utils/performance/segmentExplorer/segmentExplorerQuery';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import CellAction, {Actions, updateQuery} from 'sentry/views/discover/table/cellAction';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {TagValue} from 'sentry/views/performance/transactionSummary/transactionOverview/tagExplorer';
import {normalizeSearchConditions} from 'sentry/views/performance/transactionSummary/utils';

import type {TagsTableColumn, TagsTableColumnKeys} from './tagsDisplay';
import {TAGS_TABLE_COLUMN_ORDER} from './tagsDisplay';
import {trackTagPageInteraction} from './utils';

const TAGS_CURSOR_NAME = 'tags_cursor';

type Props = {
  aggregateColumn: string;
  eventView: EventView;
  isLoading: boolean;
  organization: Organization;
  pageLinks: string | null;
  projects: Project[];
  tableData: TableData | null;
  transactionName: string;
  onCursor?: CursorHandler;
  tagKey?: string;
};

export function TagValueTable({
  aggregateColumn,
  eventView,
  isLoading,
  organization,
  pageLinks,
  tableData,
  onCursor,
  tagKey,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const renderHeadCell = (
    sortedEventView: EventView,
    tableMeta: TableData['meta'],
    column: TableColumn<TagsTableColumnKeys>,
    columnInfo: TagsTableColumn
  ): React.ReactNode => {
    const align = fieldAlignment(column.key, column.type, tableMeta);
    const field = {field: column.key, width: column.width};

    function generateSortLink(): LocationDescriptorObject | undefined {
      if (!tableMeta) {
        return undefined;
      }

      const nextEventView = sortedEventView.sortOnField(field, tableMeta);
      const {sort} = nextEventView.generateQueryStringObject();

      return {
        ...location,
        query: {...location.query, [TAGS_CURSOR_NAME]: undefined, tagSort: sort},
      };
    }
    const currentSort = sortedEventView.sortForField(field, tableMeta);

    const currentSortKind = currentSort ? currentSort.kind : undefined;

    return (
      <SortLink
        align={align}
        title={columnInfo.name}
        direction={currentSortKind}
        canSort
        generateSortLink={generateSortLink}
      />
    );
  };

  const renderHeadCellWithMeta = (
    sortedEventView: EventView,
    tableMeta: TableData['meta'],
    columns: TagsTableColumn[]
  ) => {
    return (column: TableColumn<TagsTableColumnKeys>, index: number): React.ReactNode =>
      renderHeadCell(sortedEventView, tableMeta, column, columns[index]!);
  };

  const handleTagValueClick = (tagValue: string) => {
    const queryString = decodeScalar(location.query.query);
    const conditions = new MutableSearch(queryString ?? '');

    conditions.addFilterValues(tagKey ?? '', [tagValue]);

    navigate(
      {
        ...location,
        query: {
          ...location.query,
          query: conditions.formatString(),
        },
      },
      {replace: false}
    );
  };

  const handleCellAction = (
    column: TableColumn<TagsTableColumnKeys>,
    tagValue: string | number,
    actionRow: any
  ) => {
    return (action: Actions) => {
      trackTagPageInteraction(organization);

      const searchConditions = normalizeSearchConditions(eventView.query);

      updateQuery(searchConditions, action, {...column, name: actionRow.id}, tagValue);

      browserHistory.push({
        pathname: location.pathname,
        query: {
          ...location.query,
          [TAGS_CURSOR_NAME]: undefined,
          query: searchConditions.formatString(),
        },
      });
    };
  };

  const generateReleaseLocation = (release: string) => {
    const {project} = location.query;

    return {
      pathname: `/organizations/${organization.slug}/releases/${encodeURIComponent(
        release
      )}`,
      query: {project},
    };
  };

  const handleReleaseLinkClicked = () => {
    trackAnalytics('performance_views.tags.jump_to_release', {
      organization,
    });
  };

  const renderBodyCell = (
    column: TableColumn<TagsTableColumnKeys>,
    dataRow: TableDataRow
  ): React.ReactNode => {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const value = dataRow[column.key];

    if (column.key === 'key') {
      return dataRow.tags_key;
    }

    const allowActions = [Actions.ADD, Actions.EXCLUDE, Actions.OPEN_INTERNAL_LINK];

    if (column.key === 'tagValue') {
      const actionRow = {...dataRow, id: dataRow.tags_key};

      return (
        <CellAction
          column={column}
          dataRow={actionRow}
          handleCellAction={handleCellAction(column, dataRow.tags_value, actionRow)}
          allowActions={allowActions}
        >
          {column.name === 'release' ? (
            <Link
              to={generateReleaseLocation(dataRow.tags_value)}
              onClick={handleReleaseLinkClicked}
            >
              <TagValue row={dataRow} />
            </Link>
          ) : (
            <TagValue row={dataRow} />
          )}
        </CellAction>
      );
    }

    if (column.key === 'frequency') {
      return <AlignRight>{formatPercentage(dataRow.frequency, 0)}</AlignRight>;
    }

    if (column.key === 'action') {
      const searchConditions = new MutableSearch(eventView.query);
      const disabled = searchConditions.hasFilter(dataRow.tags_key);
      return (
        <AlignRight>
          <LinkContainer
            disabled={disabled}
            onClick={() => {
              if (disabled) {
                return;
              }

              trackTagPageInteraction(organization);
              handleTagValueClick(dataRow.tags_value);
            }}
          >
            <IconAdd />
            {t('Add to filter')}
          </LinkContainer>
        </AlignRight>
      );
    }

    if (column.key === 'comparison') {
      const localValue = dataRow.comparison;
      const pct = formatPercentage(localValue - 1, 0);
      return localValue > 1 ? t('+%s slower', pct) : t('%s faster', pct);
    }

    if (column.key === 'aggregate') {
      return (
        <AlignRight>
          <PerformanceDuration abbreviation milliseconds={dataRow.aggregate} />
        </AlignRight>
      );
    }

    if (column.key === 'sumdelta') {
      return (
        <AlignRight>
          <PerformanceDuration abbreviation milliseconds={dataRow.sumdelta} />
        </AlignRight>
      );
    }

    if (column.key === 'count') {
      return <AlignRight>{value}</AlignRight>;
    }

    return value;
  };

  const renderBodyCellWithData = (
    column: TableColumn<TagsTableColumnKeys>,
    dataRow: TableDataRow
  ): React.ReactNode => renderBodyCell(column, dataRow);

  const {columns, handleResizeColumn} = useStateBasedColumnResize({
    columns: TAGS_TABLE_COLUMN_ORDER,
  });

  const newColumns = columns.map(c => {
    const newColumn = {...c};
    if (c.key === 'tagValue' && tagKey) {
      newColumn.name = tagKey;
    }
    if (c.key === 'aggregate') {
      if (aggregateColumn === 'measurements.lcp') {
        newColumn.name = 'Avg LCP';
      }
    }
    return newColumn;
  });

  return (
    <StyledPanelTable>
      <VisuallyCompleteWithData
        id="TransactionTags-TagValueTable"
        hasData={!!tableData?.data?.length}
        isLoading={isLoading}
      >
        <GridEditable
          isLoading={isLoading}
          data={tableData?.data ? tableData.data : []}
          columnOrder={newColumns}
          columnSortBy={[]}
          grid={{
            renderHeadCell: renderHeadCellWithMeta(
              eventView,
              tableData ? tableData.meta : {},
              newColumns
            ) as any,
            renderBodyCell: renderBodyCellWithData as any,
            onResizeColumn: handleResizeColumn,
          }}
        />
      </VisuallyCompleteWithData>

      <Pagination pageLinks={pageLinks} onCursor={onCursor} size="sm" />
    </StyledPanelTable>
  );
}

const StyledPanelTable = styled('div')`
  > div {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }
`;

const AlignRight = styled('div')`
  text-align: right;
  flex: 1;
`;

const LinkContainer = styled('div')<{disabled?: boolean}>`
  cursor: pointer;
  color: ${p => p.theme.tokens.interactive.link.accent.rest};
  display: grid;
  grid-auto-flow: column;
  gap: ${space(0.5)};
  justify-content: flex-end;
  align-items: center;
  ${p =>
    p.disabled &&
    css`
      opacity: 0.5;
      color: ${p.theme.tokens.content.disabled};
      cursor: default;
    `}
`;
