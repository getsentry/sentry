import {Fragment} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import type {GridColumnHeader} from 'sentry/components/gridEditable';
import GridEditable from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import {Tooltip} from 'sentry/components/tooltip';
import {IconProfiling} from 'sentry/icons/iconProfiling';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import type {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {MetaType} from 'sentry/utils/discover/eventView';
import type EventView from 'sentry/utils/discover/eventView';
import {isFieldSortable} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Sort} from 'sentry/utils/discover/fields';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import type {TableColumn} from 'sentry/views/discover/table/types';
import SubregionSelector from 'sentry/views/insights/common/views/spans/selectors/subregionSelector';
import {DeviceClassSelector} from 'sentry/views/insights/mobile/common/components/deviceClassSelector';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {ModuleName} from 'sentry/views/insights/types';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';

type Props = {
  columnNameMap: Record<string, string>;
  cursorName: string;
  eventIdKey: 'id' | 'transaction.id';
  eventView: EventView;
  isLoading: boolean;
  profileIdKey: 'profile.id' | 'profile_id';
  sort: Sort;
  sortKey: string;
  data?: TableData;
  footerAlignedPagination?: boolean;
  pageLinks?: string;
  showDeviceClassSelector?: boolean;
};

const ICON_FIELDS = ['profile.id', 'profile_id'];

export function EventSamplesTable({
  cursorName,
  sortKey,
  showDeviceClassSelector,
  eventView,
  data,
  isLoading,
  pageLinks,
  eventIdKey,
  profileIdKey,
  columnNameMap,
  sort,
  footerAlignedPagination = false,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  const {view} = useDomainViewFilters();
  const eventViewColumns = eventView.getColumns();

  function renderBodyCell(column: any, row: any): React.ReactNode {
    if (!data?.meta || !data?.meta.fields) {
      return row[column.key];
    }

    if (column.key === eventIdKey) {
      return (
        <Link
          to={generateLinkToEventInTraceView({
            eventId: row[eventIdKey],
            projectSlug: row['project.name'],
            traceSlug: row.trace,
            timestamp: row.timestamp,
            organization,
            location,
            view,
            source: TraceViewSources.SCREEN_LOADS_MODULE,
          })}
        >
          {row[eventIdKey].slice(0, 8)}
        </Link>
      );
    }

    if (column.key === profileIdKey) {
      const profileTarget =
        defined(row['project.name']) && defined(row[profileIdKey])
          ? generateProfileFlamechartRoute({
              organization,
              projectSlug: row['project.name'],
              profileId: String(row[profileIdKey]),
            })
          : null;
      return (
        <IconWrapper>
          {profileTarget && (
            <Tooltip title={t('View Profile')}>
              <LinkButton to={profileTarget} size="xs" aria-label={t('View Profile')}>
                <IconProfiling size="xs" />
              </LinkButton>
            </Tooltip>
          )}
        </IconWrapper>
      );
    }

    const renderer = getFieldRenderer(column.key, data?.meta.fields, false);
    const rendered = renderer(row, {
      location,
      organization,
      unit: data?.meta.units?.[column.key],
    });
    return rendered;
  }

  function renderHeadCell(
    column: GridColumnHeader,
    tableMeta?: MetaType
  ): React.ReactNode {
    const fieldType = tableMeta?.fields?.[column.key];
    let alignment = fieldAlignment(column.key as string, fieldType);
    if (ICON_FIELDS.includes(column.key as string)) {
      alignment = 'right';
    }
    const field = {
      field: column.key as string,
      width: column.width,
    };

    function generateSortLink() {
      if (!tableMeta) {
        return undefined;
      }

      let newSortDirection: Sort['kind'] = 'desc';
      if (sort?.field === column.key) {
        if (sort.kind === 'desc') {
          newSortDirection = 'asc';
        }
      }

      const newSort = `${newSortDirection === 'desc' ? '-' : ''}${column.key}`;

      return {
        ...location,
        query: {...location.query, [sortKey]: newSort},
      };
    }

    const canSort = isFieldSortable(field, tableMeta?.fields, true);

    const sortLink = (
      <SortLink
        align={alignment}
        title={column.name}
        direction={sort?.field === column.key ? sort.kind : undefined}
        canSort={canSort}
        generateSortLink={generateSortLink}
      />
    );
    return sortLink;
  }

  const columnSortBy = eventView.getSorts();

  const handleCursor: CursorHandler = (newCursor, pathname, query) => {
    navigate({
      pathname,
      query: {...query, [cursorName]: newCursor},
    });
  };

  return (
    <Fragment>
      {!footerAlignedPagination && (
        <Header>
          {showDeviceClassSelector && (
            <StyledControls>
              <DeviceClassSelector moduleName={ModuleName.SCREEN_LOAD} />
              <SubregionSelector size="xs" />
            </StyledControls>
          )}

          <StyledPagination size="xs" pageLinks={pageLinks} onCursor={handleCursor} />
        </Header>
      )}
      <GridContainer>
        <GridEditable
          isLoading={isLoading}
          data={data?.data as TableDataRow[]}
          columnOrder={eventViewColumns
            .filter((col: TableColumn<React.ReactText>) =>
              Object.keys(columnNameMap).includes(col.name)
            )
            .map((col: TableColumn<React.ReactText>) => {
              return {...col, name: columnNameMap[col.key]!};
            })}
          columnSortBy={columnSortBy}
          grid={{
            renderHeadCell: column => renderHeadCell(column, data?.meta),
            renderBodyCell,
          }}
        />
      </GridContainer>
      <div>
        {footerAlignedPagination && (
          <StyledPagination size="xs" pageLinks={pageLinks} onCursor={handleCursor} />
        )}
      </div>
    </Fragment>
  );
}

const StyledPagination = styled(Pagination)`
  margin: 0 0 0 ${space(1)};
`;

const Header = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  margin-bottom: ${space(1)};
  align-items: center;
  height: 26px;
`;

const StyledControls = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const IconWrapper = styled('div')`
  text-align: right;
  width: 100%;
  height: 26px;
`;

// Not pretty but we need to override gridEditable styles since the original
// styles have too much padding for small spaces
const GridContainer = styled('div')`
  margin-bottom: ${space(1)};
  th {
    padding: 0 ${space(1)};
  }
  th:first-child {
    padding-left: ${space(2)};
  }
  th:last-child {
    padding-right: ${space(2)};
  }
  td {
    padding: ${space(0.5)} ${space(1)};
  }
  td:first-child {
    padding-right: ${space(1)};
    padding-left: ${space(2)};
  }
`;
