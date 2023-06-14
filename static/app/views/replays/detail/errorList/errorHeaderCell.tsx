import {ComponentProps, CSSProperties, forwardRef, ReactNode} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow, IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useSortErrors from 'sentry/views/replays/detail/errorList/useSortErrors';

type SortConfig = ReturnType<typeof useSortErrors>['sortConfig'];
type Props = {
  handleSort: ReturnType<typeof useSortErrors>['handleSort'];
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
  {field: 'id', label: t('Event ID')},
  {field: 'title', label: t('Title')},
  {field: 'project', label: t('Issue')},
  {field: 'timestamp', label: t('Timestamp')},
];

export const COLUMN_COUNT = COLUMNS.length;

function CatchClicks({children}: {children: ReactNode}) {
  return <div onClick={e => e.stopPropagation()}>{children}</div>;
}

const ErrorHeaderCell = forwardRef<HTMLButtonElement, Props>(
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
  white-space: nowrap;

  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(0.5)} ${space(1)} ${space(0.5)} ${space(1.5)};

  svg {
    margin-left: ${space(0.25)};
  }
`;

export default ErrorHeaderCell;
