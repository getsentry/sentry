import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import Duration from 'sentry/components/duration';
import type {GridColumnHeader, GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable from 'sentry/components/gridEditable';
import renderSortableHeaderCell from 'sentry/components/replays/renderSortableHeaderCell';
import useQueryBasedColumnResize from 'sentry/components/replays/useQueryBasedColumnResize';
import useQueryBasedSorting from 'sentry/components/replays/useQueryBasedSorting';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import useOrganization from 'sentry/utils/useOrganization';

type ReleaseAdoptionItem = {
  adoption: number;
  adoption_stage: string;
  date: string;
  lifespan: number | undefined;
  project_id: number;
  release: string;
};

interface Props {
  data: ReleaseAdoptionItem[];
  isError: boolean;
  isLoading: boolean;
  location: Location<any>;
  meta: EventsMetaType;
}

type Column = GridColumnHeader<keyof ReleaseAdoptionItem>;

const BASE_COLUMNS: Array<GridColumnOrder<keyof ReleaseAdoptionItem>> = [
  {key: 'release', name: 'version'},
  {key: 'date', name: 'date created'},
  {key: 'lifespan', name: 'lifespan'},
  {key: 'adoption', name: 'adoption'},
  {key: 'adoption_stage', name: 'stage'},
];

export default function ReleaseAdoptionTable({
  data,
  isError,
  isLoading,
  location,
  meta,
}: Props) {
  const {currentSort, makeSortLinkGenerator} = useQueryBasedSorting({
    defaultSort: {field: 'date', kind: 'desc'},
    location,
  });

  const {columns, handleResizeColumn} = useQueryBasedColumnResize({
    columns: BASE_COLUMNS,
    location,
    paramName: 'width_adoption_table',
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
    (column: Column, dataRow: ReleaseAdoptionItem) => {
      const value = dataRow[column.key];

      if (column.key === 'lifespan') {
        return value !== undefined ? (
          <CellWrapper>
            <Duration
              precision="hours"
              abbreviation
              seconds={(value as number) * (1 / 1000)}
            />
          </CellWrapper>
        ) : (
          // the last lifespan in the table is rendered as '--' since there's nothing previous to compare it to
          '--'
        );
      }

      if (column.key === 'adoption') {
        return `${(value as number).toFixed(2)}%`;
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
            unit: meta.units?.[column.key],
          })}
        </CellWrapper>
      );
    },
    [organization, location, meta]
  );

  const tableEmptyMessage = (
    <MessageContainer>
      <Title>{t('No release adoption data was found')}</Title>
      <Subtitle>
        {t(
          'There was no release adoption data within this timeframe. Try expanding your timeframe or changing your global filters.'
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
      emptyMessage={tableEmptyMessage}
      columnSortBy={[]}
      stickyHeader
      grid={{
        onResizeColumn: handleResizeColumn,
        renderHeadCell,
        renderBodyCell: (column, row) => renderBodyCell(column, row),
      }}
      title={t('Release Adoption')}
    />
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
