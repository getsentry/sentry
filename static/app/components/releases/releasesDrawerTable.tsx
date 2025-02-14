import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import Count from 'sentry/components/count';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import type {GridColumnHeader, GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable from 'sentry/components/gridEditable';
import Pagination from 'sentry/components/pagination';
import renderSortableHeaderCell from 'sentry/components/replays/renderSortableHeaderCell';
import useQueryBasedColumnResize from 'sentry/components/replays/useQueryBasedColumnResize';
import useQueryBasedSorting from 'sentry/components/replays/useQueryBasedSorting';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useOrganizationReleases from 'sentry/views/insights/sessions/queries/useOrganizationReleases';
import {getReleaseNewIssuesUrl} from 'sentry/views/releases/utils';

type ReleaseHealthItem = {
  adoption_stage: string;
  crash_free_sessions: number;
  date: string;
  error_count: number;
  project_id: number;
  release: string;
  sessions: number;
};

interface Props {
  end: string;
  start: string;
}

type Column = GridColumnHeader<keyof ReleaseHealthItem>;

const BASE_COLUMNS: Array<GridColumnOrder<keyof ReleaseHealthItem>> = [
  {key: 'release', name: 'version'},
  {key: 'adoption_stage', name: 'stage'},
  {key: 'crash_free_sessions', name: 'crash free rate'},
  {key: 'sessions', name: 'total sessions'},
  {key: 'error_count', name: 'new issues'},
  {key: 'date', name: 'created'},
];

/**
 * This is copied/modified of
 * `views/insights/sessions/components/tables/releaseHealthTable`, we
 * can't re-use because this will eventually be a bit different,
 * especially with the in-drawer navigation.
 */
export function ReleaseDrawerTable({start, end}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const {releaseData, isLoading, isError, pageLinks} = useOrganizationReleases({
    tableType: 'health',
    filters: [],
    dateRange: {
      start,
      end,
      statsPeriod: undefined,
    },
  });

  const {currentSort, makeSortLinkGenerator} = useQueryBasedSorting({
    defaultSort: {field: 'date', kind: 'desc'},
    location,
  });

  const {columns, handleResizeColumn} = useQueryBasedColumnResize({
    columns: BASE_COLUMNS,
    location,
  });

  const organization = useOrganization();

  const renderHeadCell = useMemo(
    () =>
      renderSortableHeaderCell({
        currentSort,
        makeSortLinkGenerator,
        onClick: () => {},
        rightAlignedColumns: [],
        sortableColumns: [],
      }),
    [currentSort, makeSortLinkGenerator]
  );

  const renderBodyCell = useCallback(
    (column: Column, dataRow: ReleaseHealthItem) => {
      const value = dataRow[column.key];
      const meta: EventsMetaType = {
        fields: {
          release: 'string',
          date: 'date',
          stage: 'string',
          crash_free_sessions: 'percentage',
          sessions: 'integer',
          error_count: 'integer',
        },
        units: {
          crash_free_sessions: '%',
        },
      };

      if (column.key === 'release') {
        // Custom release renderer -- we want to keep navigation within drawer
        return <TextOverflow>{value}</TextOverflow>;
      }

      if (column.key === 'crash_free_sessions') {
        return `${(value as number).toFixed(2)}%`;
      }

      if (column.key === 'error_count') {
        return (
          <Tooltip title={t('Open in Issues')} position="auto-start">
            <GlobalSelectionLink
              to={getReleaseNewIssuesUrl(
                organization.slug,
                dataRow.project_id,
                dataRow.release
              )}
            >
              <Count value={value} />
            </GlobalSelectionLink>
          </Tooltip>
        );
      }
      if (!meta?.fields) {
        return value;
      }

      const renderer = getFieldRenderer(column.key, meta.fields, false);

      return (
        <CellWrapper>
          {renderer(dataRow, {
            location,
            organization,
            unit: meta.units[column.key],
          })}
        </CellWrapper>
      );
    },
    [organization, location]
  );

  const tableEmptyMessage = (
    <MessageContainer>
      <Title>{t('No releases')}</Title>
      <Subtitle>{t('There are no releases within this timeframe')}</Subtitle>
    </MessageContainer>
  );

  return (
    <Fragment>
      <GridEditable
        error={isError}
        isLoading={isLoading}
        data={releaseData ?? []}
        columnOrder={columns}
        emptyMessage={tableEmptyMessage}
        columnSortBy={[]}
        stickyHeader
        grid={{
          onResizeColumn: handleResizeColumn,
          renderHeadCell,
          renderBodyCell,
        }}
      />
      <PaginationNoMargin
        pageLinks={pageLinks}
        onCursor={(cursor, path, searchQuery) => {
          navigate({
            pathname: path,
            query: {...searchQuery, cursor},
          });
        }}
      />
    </Fragment>
  );
}

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

const CellWrapper = styled('div')`
  & div {
    text-align: left;
  }
`;
const PaginationNoMargin = styled(Pagination)`
  margin: 0;
`;
