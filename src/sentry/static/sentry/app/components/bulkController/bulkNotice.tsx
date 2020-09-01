import React from 'react';
import styled from '@emotion/styled';

import {tn, tct, t} from 'app/locale';
import {defined} from 'app/utils';

import {PanelAlert} from '../panels';
import Button from '../button';

export function getEverythingSelectedText(allRowsCount?: number, bulkLimit?: number) {
  if (!defined(allRowsCount)) {
    return t('Selected all items across all pages.');
  }
  if (bulkLimit && allRowsCount > bulkLimit) {
    return tct('Selected up to the first [count] items.', {
      count: bulkLimit,
    });
  }

  return tct('Selected all [count] items.', {
    count: allRowsCount,
  });
}

export function getSelectEverythingText(allRowsCount?: number, bulkLimit?: number) {
  if (!defined(allRowsCount)) {
    return t('Select all items across all pages.');
  }
  if (bulkLimit && allRowsCount > bulkLimit) {
    return tct('Select the first [count] items.', {
      count: bulkLimit,
    });
  }

  return tct('Select all [count] items.', {
    count: allRowsCount,
  });
}

type Props = {
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
  /**
   * Number of all rows across all pages
   */
  allRowsCount?: number;
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
  bulkLimit,
  className,
}: Props) {
  if ((allRowsCount && allRowsCount <= selectedRowsCount) || !isPageSelected) {
    return null;
  }

  return (
    <Wrapper columnsCount={columnsCount} className={className}>
      {isEverythingSelected ? (
        <React.Fragment>
          {getEverythingSelectedText(allRowsCount, bulkLimit)}{' '}
          <StyledButton priority="link" onClick={onCancelAllRows}>
            {t('Cancel selection.')}
          </StyledButton>
        </React.Fragment>
      ) : (
        <React.Fragment>
          {tn(
            '%s item on this page selected.',
            '%s items on this page selected.',
            selectedRowsCount
          )}{' '}
          <StyledButton priority="link" onClick={onSelectAllRows}>
            {getSelectEverythingText(allRowsCount, bulkLimit)}
          </StyledButton>
        </React.Fragment>
      )}
    </Wrapper>
  );
}

type WrapperProps = {columnsCount: number} & React.ComponentProps<typeof PanelAlert>;
const Wrapper = styled(({columnsCount: _columnsCount, ...props}: WrapperProps) => (
  <PanelAlert {...props} />
))`
  grid-column: span ${p => p.columnsCount};
  text-align: center;
`;

const StyledButton = styled(Button)`
  &,
  &:hover,
  &:active,
  &:focus {
    /* match the styles of an <a> tag inside Alert */
    color: ${p => p.theme.textColor};
    border: none;
    border-radius: 0;
    border-bottom: 1px dotted ${p => p.theme.textColor};
    padding-bottom: 1px;
    font-size: 15px;
  }
`;

export default BulkNotice;
