import {ComponentProps, CSSProperties, forwardRef, ReactNode} from 'react';
import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow, IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useSortNetwork from 'sentry/views/replays/detail/network/useSortNetwork';

type SortConfig = ReturnType<typeof useSortNetwork>['sortConfig'];
type Props = {
  handleSort: ReturnType<typeof useSortNetwork>['handleSort'];
  index: number;
  sortConfig: SortConfig;
  style: CSSProperties;
};

const SizeInfoIcon = styled(IconInfo)`
  display: block;
`;

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

function CatchClicks({children}: {children: ReactNode}) {
  return <div onClick={e => e.stopPropagation()}>{children}</div>;
}

const NetworkHeaderCell = forwardRef<HTMLButtonElement, Props>(
  ({handleSort, index, sortConfig, style}: Props, ref) => {
    const {field, label, tooltipTitle} = COLUMNS[index];
    return (
      <HeaderButton style={style} onClick={() => handleSort(field)} ref={ref}>
        {label}
        {tooltipTitle ? (
          <Tooltip isHoverable title={<CatchClicks>{tooltipTitle}</CatchClicks>}>
            <SizeInfoIcon size="xs" />
          </Tooltip>
        ) : null}
        <IconArrow
          color="gray300"
          size="xs"
          direction={sortConfig.by === field && !sortConfig.asc ? 'down' : 'up'}
          style={{visibility: sortConfig.by === field ? 'visible' : 'hidden'}}
        />
      </HeaderButton>
    );
  }
);

const HeaderButton = styled('button')`
  border: 0;
  border-bottom: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.subText};

  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  line-height: 16px;
  text-align: unset;
  text-transform: uppercase;

  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(0.5)} ${space(1)} ${space(0.5)} ${space(1.5)};

  svg {
    margin-left: ${space(0.25)};
  }
`;

export default NetworkHeaderCell;
