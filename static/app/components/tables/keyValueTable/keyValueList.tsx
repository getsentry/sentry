import {useMemo} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';
import sortBy from 'lodash/sortBy';

import type {KeyValueListData} from 'sentry/types/group';
import {defined} from 'sentry/utils/defined';

import {KeyValueTableContextProvider} from './context';
import {Content} from './keyValueDataContent';

interface KeyValueTableDataListProps {
  className?: string;
  data?: KeyValueListData;
  /**
   * Renders values with the expandable structured event data viewer.
   */
  isContextData?: boolean;
  /**
   * Stringifies values before handing them to the structured event data viewer.
   */
  raw?: boolean;
  shouldSort?: boolean;
}

export function KeyValueList({
  data,
  isContextData = false,
  shouldSort = true,
  raw = false,
  className,
  ...props
}: KeyValueTableDataListProps) {
  const context = useMemo(
    () => ({variant: 'list', isContextData, raw}) as const,
    [isContextData, raw]
  );

  if (!defined(data) || data.length === 0) {
    return null;
  }

  const rows = shouldSort ? sortBy(data, [({key}) => key?.toLowerCase()]) : data;

  return (
    <Table className={classNames('table key-value', className)} {...props}>
      <tbody>
        <KeyValueTableContextProvider value={context}>
          {rows.map((item, index) => (
            <Content key={`${item.key}-${index}`} item={item} meta={item.meta} />
          ))}
        </KeyValueTableContextProvider>
      </tbody>
    </Table>
  );
}

const Table = styled('table')`
  > * pre > pre {
    margin: 0 !important;
    padding: 0 !important;
  }
`;
