import type {ComponentProps, CSSProperties} from 'react';

import {ExternalLink} from '@sentry/scraps/link';
import type {Tooltip} from '@sentry/scraps/tooltip';

import {HeaderCell} from 'sentry/components/replays/virtualizedGrid/headerCell';
import type {ColumnAlign} from 'sentry/components/tables/sortableHeaderCell';
import {t, tct} from 'sentry/locale';
import type {useSortNetwork} from 'sentry/views/explore/replays/detail/network/useSortNetwork';

type SortConfig = ReturnType<typeof useSortNetwork>['sortConfig'];
type Props = {
  handleSort: ReturnType<typeof useSortNetwork>['handleSort'];
  index: number;
  sortConfig: SortConfig;
  style: CSSProperties;
};

const COLUMNS: Array<{
  field: SortConfig['by'];
  label: string;
  width: string;
  align?: ColumnAlign;
  tooltipTitle?: ComponentProps<typeof Tooltip>['title'];
}> = [
  {field: 'method', label: t('Method'), width: '80px'},
  {
    field: 'status',
    label: t('Status'),
    width: '88px',
    tooltipTitle: tct(
      'If the status is [zero], the resource might be a cross-origin request.[linebreak][linebreak]Configure the server to respond with the CORS header [header] to see the actual response codes. [mozilla].',
      {
        zero: <code>0</code>,
        header: <code>Access-Control-Allow-Origin</code>,
        linebreak: <br />,
        mozilla: (
          <ExternalLink href="https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/responseStatus#cross-origin_response_status_codes">
            Learn more on MDN
          </ExternalLink>
        ),
      }
    ),
  },
  {field: 'description', label: t('Path'), width: 'minmax(160px, 1fr)'},
  {
    field: 'op',
    label: t('Type'),
    width: '72px',
  },
  {
    field: 'size',
    label: t('Size'),
    width: '84px',
    align: 'right',
    tooltipTitle: t(
      'The number used for fetch/xhr is the response body size. It is possible the network transfer size is smaller due to compression.'
    ),
  },
  {field: 'duration', label: t('Duration'), width: '88px', align: 'right'},
  {field: 'startTimestamp', label: t('Timestamp'), width: '108px', align: 'right'},
];

export const COLUMN_COUNT = COLUMNS.length;

export const TABLE_COLUMNS = COLUMNS.map(({field, width}) => ({key: field, width}));

export function NetworkHeaderCell({handleSort, index, sortConfig, style}: Props) {
  const {align, field, label, tooltipTitle} = COLUMNS[index]!;
  return (
    <HeaderCell
      align={align}
      handleSort={handleSort}
      field={field}
      label={label}
      tooltipTitle={tooltipTitle}
      sortConfig={sortConfig}
      style={style}
    />
  );
}
