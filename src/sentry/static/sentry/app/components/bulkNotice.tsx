import React from 'react';
import styled from '@emotion/styled';

import Alert from 'app/components/alert';
import {tn, tct, t} from 'app/locale';

type Props = {
  /**
   * Number of all rows across all pages
   */
  allRowsCount: number;
  /**
   * Number of selected rows
   */
  selectedRowsCount: number;
  /**
   * Are all rows on current page selected?
   */
  isPageSelected: boolean;
  /**
   * Are all rows across all pages selected?
   */
  isEverythingSelected: boolean;
  /**
   * Callback to select all rows across all pages
   */
  onSelectAllRows: () => void;
  /**
   * Callback to clear selection of all rows
   */
  onCancelAllRows: () => void;
  /**
   * Number of columns to stretch the notice (used in grid-column)
   */
  columnsCount: number;
  /**
   * Number of max items we can perform bulk operations on, defaults to 1000
   */
  bulkLimit?: number;
  className?: string;
};

function BulkNotice({
  allRowsCount,
  selectedRowsCount,
  isPageSelected,
  isEverythingSelected,
  onSelectAllRows,
  onCancelAllRows,
  columnsCount,
  bulkLimit = 1000,
  className,
}: Props) {
  if (allRowsCount <= selectedRowsCount || !isPageSelected) {
    return null;
  }

  return (
    <Wrapper columnsCount={columnsCount} className={className}>
      {isEverythingSelected ? (
        <React.Fragment>
          {allRowsCount >= bulkLimit
            ? tct('Selected up to the first [count] items.', {
                count: bulkLimit,
              })
            : tct('Selected all [count] items.', {
                count: allRowsCount,
              })}{' '}
          <a onClick={onCancelAllRows}>{t('Cancel selection.')}</a>
        </React.Fragment>
      ) : (
        <React.Fragment>
          {tn(
            '%s item on this page selected.',
            '%s items on this page selected.',
            selectedRowsCount
          )}{' '}
          <a onClick={onSelectAllRows}>
            {allRowsCount >= bulkLimit
              ? tct('Select the first [count] items.', {
                  count: bulkLimit,
                })
              : tct('Select all [count] items.', {
                  count: allRowsCount,
                })}
          </a>
        </React.Fragment>
      )}
    </Wrapper>
  );
}

type WrapperProps = {columnsCount: number} & React.ComponentProps<typeof Alert>;
const Wrapper = styled(({columnsCount: _columnsCount, ...props}: WrapperProps) => (
  <Alert {...props} />
))`
  grid-column: span ${p => p.columnsCount};
  border-radius: 0;
  margin-bottom: 0;
  border: none;
  text-align: center;
`;

export default BulkNotice;
