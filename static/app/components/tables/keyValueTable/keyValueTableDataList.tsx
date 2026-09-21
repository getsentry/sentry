import styled from '@emotion/styled';
import classNames from 'classnames';
import sortBy from 'lodash/sortBy';

import {Flex} from '@sentry/scraps/layout';

import type {KeyValueListData, KeyValueListDataItem} from 'sentry/types/group';
import {defined} from 'sentry/utils/defined';

import {PreformattedValue, ValueLink} from './value';

interface KeyValueTableDataListProps {
  className?: string;
  data?: KeyValueListData;
  margin?: boolean;
  shouldSort?: boolean;
}

export function KeyValueTableDataList({
  data,
  shouldSort = true,
  margin = false,
  className,
  ...props
}: KeyValueTableDataListProps) {
  if (!defined(data) || data.length === 0) {
    return null;
  }

  const rows = shouldSort ? sortBy(data, [({key}) => key?.toLowerCase()]) : data;

  return (
    <Table
      margin={margin}
      className={classNames('table key-value', className)}
      {...props}
    >
      <tbody>
        {rows.map((item, index) => (
          <Row key={`${item.key}-${index}`} item={item} />
        ))}
      </tbody>
    </Table>
  );
}

function Row({item}: {item: KeyValueListDataItem}) {
  const {
    subject,
    subjectNode,
    subjectIcon,
    subjectDataTestId,
    meta,
    value = null,
    action,
    actionButton,
    isMultiValue,
  } = item;

  const renderValue = (v: KeyValueListDataItem['value']) => (
    <PreformattedValue value={v} meta={meta} subjectIcon={subjectIcon} />
  );

  const rendered =
    isMultiValue && Array.isArray(value) ? (
      value.map((entry, index) => <PreformattedValue key={index} value={entry} />)
    ) : action?.link ? (
      <ValueLink to={action.link}>{renderValue(value)}</ValueLink>
    ) : (
      renderValue(value)
    );

  return (
    <tr>
      <td className="key">{subjectNode ?? subject}</td>
      <td className="val" data-test-id={subjectDataTestId}>
        <TableValue>
          {actionButton ? (
            <ValueWithButton>
              {rendered}
              <Flex align="start" height="100%">
                {actionButton}
              </Flex>
            </ValueWithButton>
          ) : (
            rendered
          )}
        </TableValue>
      </td>
    </tr>
  );
}

const Table = styled('table')<{margin: boolean}>`
  && {
    margin-bottom: ${p => (p.margin ? undefined : 0)};
  }
  > * pre > pre {
    margin: 0 !important;
    padding: 0 !important;
  }
`;

const TableValue = styled('div')`
  pre {
    && {
      word-break: break-all;
    }
  }
  pre > pre {
    display: inline-block;
  }
`;

const ValueWithButton = styled('div')`
  display: grid;
  align-items: center;
  gap: ${p => p.theme.space.md};
  font-size: ${p => p.theme.font.size.sm};
  background: ${p => p.theme.tokens.background.secondary};
  padding: ${p => p.theme.space.md} 10px;
  margin: ${p => p.theme.space['2xs']} 0;
  border-radius: ${p => p.theme.radius.md};
  pre {
    padding: 0 !important;
    margin: 0 !important;
  }

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: 1fr max-content;
  }
`;
