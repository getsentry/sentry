import type {ComponentProps, CSSProperties} from 'react';
import {forwardRef} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import HeaderCell from 'sentry/components/replays/virtualizedGrid/headerCell';
import type {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import type useSortNetwork from 'sentry/views/replays/detail/network/useSortNetwork';

type SortConfig = ReturnType<typeof useSortNetwork>['sortConfig'];
type Props = {
  handleSort: ReturnType<typeof useSortNetwork>['handleSort'];
  index: number;
  sortConfig: SortConfig;
  style: CSSProperties;
};

const COLUMNS: {
  field: SortConfig['by'];
  label: string;
  tooltipTitle?: ComponentProps<typeof Tooltip>['title'];
}[] = [
  {field: 'method', label: t('Method')},
  {
    field: 'status',
    label: t('Status'),
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
  {field: 'description', label: t('Path')},
  {
    field: 'op',
    label: t('Type'),
  },
  {
    field: 'size',
    label: t('Size'),
    tooltipTitle: t(
      'The number used for fetch/xhr is the response body size. It is possible the network transfer size is smaller due to compression.'
    ),
  },
  {field: 'duration', label: t('Duration')},
  {field: 'startTimestamp', label: t('Timestamp')},
];

export const COLUMN_COUNT = COLUMNS.length;

const NetworkHeaderCell = forwardRef<HTMLButtonElement, Props>(
  ({handleSort, index, sortConfig, style}: Props, ref) => {
    const {field, label, tooltipTitle} = COLUMNS[index]!;
    return (
      <HeaderCell
        ref={ref}
        handleSort={handleSort}
        field={field}
        label={label}
        tooltipTitle={tooltipTitle}
        sortConfig={sortConfig}
        style={style}
      />
    );
  }
);

export default NetworkHeaderCell;
