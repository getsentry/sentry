import type {ReactNode} from 'react';
import {Fragment} from 'react';

import {ExternalLink} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import type {ColumnAlign} from 'sentry/components/tables/sortableHeaderCell';
import {IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {useSortNetwork} from 'sentry/views/explore/replays/detail/network/useSortNetwork';

type SortConfig = ReturnType<typeof useSortNetwork>['sortConfig'];

interface Props {
  handleSort: ReturnType<typeof useSortNetwork>['handleSort'];
  sortConfig: SortConfig;
}

const COLUMNS: Array<{
  field: SortConfig['by'];
  label: string;
  width: string;
  align?: ColumnAlign;
  tooltipTitle?: ReactNode;
}> = [
  {field: 'method', label: t('Method'), width: '100px'},
  {
    field: 'status',
    label: t('Status'),
    width: '112px',
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
  {field: 'op', label: t('Type'), width: '96px'},
  {
    field: 'size',
    label: t('Size'),
    width: '104px',
    align: 'right',
    tooltipTitle: t(
      'The number used for fetch/xhr is the response body size. It is possible the network transfer size is smaller due to compression.'
    ),
  },
  {field: 'duration', label: t('Duration'), width: '120px', align: 'right'},
  {field: 'startTimestamp', label: t('Timestamp'), width: '128px', align: 'right'},
];

export const NETWORK_TABLE_COLUMNS = COLUMNS.map(({field, width}) => ({
  key: field,
  width,
}));

export function NetworkTableHeader({handleSort, sortConfig}: Props) {
  return (
    <SimpleTable.Head sticky>
      <SimpleTable.HeaderRow>
        {COLUMNS.map(({align, field, label, tooltipTitle}) => (
          <SimpleTable.HeaderCell
            key={field}
            align={align}
            handleSortClick={() => handleSort(field)}
            sort={sortConfig.by === field ? (sortConfig.asc ? 'asc' : 'desc') : undefined}
          >
            {label}
            {tooltipTitle ? (
              <Fragment>
                {' '}
                <Tooltip title={tooltipTitle}>
                  <IconInfo size="xs" />
                </Tooltip>
              </Fragment>
            ) : null}
          </SimpleTable.HeaderCell>
        ))}
      </SimpleTable.HeaderRow>
    </SimpleTable.Head>
  );
}
