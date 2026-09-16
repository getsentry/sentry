import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import {Flex} from '@sentry/scraps/layout';

import type {KeyValueListData, KeyValueListDataItem} from 'sentry/types/group';
import {defined} from 'sentry/utils/defined';

import {ContextDataValue, PreformattedValue, ValueLink} from './value';

interface KeyValueTableDataListProps {
  className?: string;
  data?: KeyValueListData;
  isContextData?: boolean;
  margin?: boolean;
  raw?: boolean;
  shouldSort?: boolean;
}

export function KeyValueTableDataList({
  data,
  isContextData = false,
  shouldSort = true,
  raw = false,
  margin = false,
  className,
  ...props
}: KeyValueTableDataListProps) {
  if (!defined(data) || data.length === 0) {
    return null;
  }

  const rows = shouldSort ? sortBy(data, [({key}) => key?.toLowerCase()]) : data;

  return (
    <Table margin={margin} className={className} {...props}>
      <tbody>
        {rows.map((item, index) => (
          <Row
            key={`${item.key}-${index}`}
            item={item}
            isContextData={isContextData}
            raw={raw}
          />
        ))}
      </tbody>
    </Table>
  );
}

function Row({
  item,
  isContextData,
  raw,
}: {
  isContextData: boolean;
  item: KeyValueListDataItem;
  raw: boolean;
}) {
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

  const renderValue = (v: KeyValueListDataItem['value']) =>
    item.isContextData || isContextData ? (
      <ContextDataValue value={v} meta={meta} raw={raw} subjectIcon={subjectIcon} />
    ) : (
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

// Literal px values below are carried over verbatim from the `table.table.key-value`
// rules this component used to inherit from global LESS. They are normalized onto
// theme tokens in a later commit; keeping them exact here is what makes this move
// a pure relocation with no visual change.
const Table = styled('table')<{margin: boolean}>`
  width: 100%;
  max-width: 100%;
  border: none;
  margin-bottom: ${p => (p.margin ? '20px' : 0)};

  td {
    padding: 0;
    max-width: 500px;
    border: 0;
    vertical-align: top;
    line-height: 1;
  }

  td.key {
    font-weight: 600;
    font-size: 13px;
    width: 175px;
    max-width: 175px;
    word-wrap: break-word;
    padding: 10px 15px 10px 10px;
    line-height: 1.4;
  }

  td pre {
    box-sizing: border-box;
    white-space: pre-wrap;
    margin: 2px 0;
    word-break: break-word;
    padding: 8px 10px;
    font-size: 12px;
    overflow: visible;
  }

  td pre .val-string:first-child {
    padding-left: 0;
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
