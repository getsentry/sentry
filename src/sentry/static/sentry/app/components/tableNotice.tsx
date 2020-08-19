import React from 'react';
import styled from '@emotion/styled';

import Alert from 'app/components/alert';
import {tn, tct, t} from 'app/locale';

const BULK_LIMIT = 1000;

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
};

function TableNotice({
  allRowsCount,
  selectedRowsCount,
  isPageSelected,
  isEverythingSelected,
  onSelectAllRows,
  onCancelAllRows,
  columnsCount,
}: Props) {
  if (allRowsCount <= selectedRowsCount || !isPageSelected) {
    return null;
  }

  return (
    <Wrapper columnsCount={columnsCount}>
      {isEverythingSelected ? (
        <React.Fragment>
          {allRowsCount >= BULK_LIMIT
            ? tct('Selected up to the first [count] items.', {
                count: BULK_LIMIT,
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
            {allRowsCount >= BULK_LIMIT
              ? tct('Select the first [count] items.', {
                  count: BULK_LIMIT,
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

const Wrapper = styled(Alert)<{columnsCount: number}>`
  grid-column: span ${p => p.columnsCount};
  border-radius: 0;
  margin-bottom: 0;
  border: none;
  text-align: center;
`;

export default TableNotice;
