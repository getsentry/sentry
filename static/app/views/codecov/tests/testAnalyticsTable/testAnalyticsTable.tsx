import {useSearchParams} from 'react-router-dom';
import styled from '@emotion/styled';

import type {GridColumnHeader} from 'sentry/components/tables/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Sort} from 'sentry/utils/discover/fields';
import {renderTableBody} from 'sentry/views/codecov/tests/testAnalyticsTable/tableBody';
import {renderTableHeader} from 'sentry/views/codecov/tests/testAnalyticsTable/tableHeader';

type TestAnalyticsTableResponse = {
  averageDurationMs: number;
  commitsFailed: number;
  flakeRate: number;
  isBrokenTest: boolean;
  lastRun: string;
  testName: string;
};

export type Row = Pick<
  TestAnalyticsTableResponse,
  | 'testName'
  | 'averageDurationMs'
  | 'flakeRate'
  | 'commitsFailed'
  | 'lastRun'
  | 'isBrokenTest'
>;
export type Column = GridColumnHeader<
  'testName' | 'averageDurationMs' | 'flakeRate' | 'commitsFailed' | 'lastRun'
>;

export type ValidSort = Sort & {
  field: (typeof SORTABLE_FIELDS)[number];
};

const COLUMNS_ORDER: Column[] = [
  {key: 'testName', name: t('Test Name'), width: COL_WIDTH_UNDEFINED},
  {key: 'averageDurationMs', name: t('Avg. Duration'), width: COL_WIDTH_UNDEFINED},
  {key: 'flakeRate', name: t('Flake Rate'), width: COL_WIDTH_UNDEFINED},
  {key: 'commitsFailed', name: t('Commits Failed'), width: COL_WIDTH_UNDEFINED},
  {key: 'lastRun', name: t('Last Run'), width: COL_WIDTH_UNDEFINED},
];

export const RIGHT_ALIGNED_FIELDS = new Set([
  'averageDurationMs',
  'flakeRate',
  'commitsFailed',
]);

export type SortableTAOptions =
  | 'testName'
  | 'averageDurationMs'
  | 'flakeRate'
  | 'commitsFailed'
  | 'lastRun';

export const SORTABLE_FIELDS: SortableTAOptions[] = [
  'testName',
  'averageDurationMs',
  'flakeRate',
  'commitsFailed',
  'lastRun',
] as const;

export function isAValidSort(sort: Sort): sort is ValidSort {
  return (SORTABLE_FIELDS as unknown as string[]).includes(sort.field);
}

interface Props {
  response: {
    data: Row[];
    isLoading: boolean;
  };
  sort: ValidSort;
}

export default function TestAnalyticsTable({response, sort}: Props) {
  const {data, isLoading} = response;
  const [searchParams] = useSearchParams();
  const wrapToggleValue = searchParams.get('wrap') === 'true';

  const selectorEmptyMessage = (
    <MessageContainer>
      <StyledIconSearch color="subText" size="xl" />
      <Title>{t('It looks like there is nothing to show right now.')}</Title>
      <Subtitle>
        {t(
          'Please consider adjusting your filters, merging data into your chosen branch, or checking if the resource is available.'
        )}
      </Subtitle>
    </MessageContainer>
  );

  return (
    <GridEditable
      aria-label={t('Test Analytics')}
      isLoading={isLoading}
      data={data ?? []}
      emptyMessage={selectorEmptyMessage}
      columnOrder={COLUMNS_ORDER}
      // TODO: This isn't used as per the docs but is still required. Test if
      // it affects sorting when backend is ready.
      columnSortBy={[
        {
          key: sort.field,
          order: sort.kind,
        },
      ]}
      grid={{
        renderHeadCell: column =>
          renderTableHeader({
            column,
            sort,
          }),
        renderBodyCell: (column, row) => renderTableBody({column, row, wrapToggleValue}),
      }}
    />
  );
}

const MessageContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  width: 350px;
  justify-items: center;
  align-items: center;
  text-align: center;
`;

const Subtitle = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
`;

const Title = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: 14px;
`;

const StyledIconSearch = styled(IconSearch)`
  margin-right: ${space(1)};
`;
