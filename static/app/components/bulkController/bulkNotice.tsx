import {Fragment} from 'react';
import styled from '@emotion/styled';

import {t, tct, tn} from 'sentry/locale';
import {defined} from 'sentry/utils';

import Button from '../button';
import {PanelAlert} from '../panels';

function getSelectAllText(allRowsCount?: number, bulkLimit?: number) {
  if (!defined(allRowsCount)) {
    return {
      noticeText: t('Selected all items across all pages.'),
      actionText: t('Select all items across all pages.'),
    };
  }

  if (bulkLimit && allRowsCount > bulkLimit) {
    return {
      noticeText: tct('Selected up to the first [count] items.', {
        count: bulkLimit,
      }),
      actionText: tct('Select the first [count] items.', {
        count: bulkLimit,
      }),
    };
  }

  return {
    noticeText: tct('Selected all [count] items.', {
      count: allRowsCount,
    }),
    actionText: tct('Select all [count] items.', {
      count: allRowsCount,
    }),
  };
}

type Props = {
  /**
   * Number of columns to stretch the notice (used in grid-column)
   */
  columnsCount: number;
  /**
   * Are all rows across all pages selected?
   */
  isAllSelected: boolean;
  /**
   * Are all rows on current page selected?
   */
  isPageSelected: boolean;
  /**
   * Callback to select all rows across all pages
   */
  onSelectAllRows: () => void;
  /**
   * Callback to clear selection of all rows
   */
  onUnselectAllRows: () => void;
  /**
   * Number of selected rows
   */
  selectedRowsCount: number;
  /**
   * Number of all rows across all pages
   */
  allRowsCount?: number;
  /**
   * Number of max items we can perform bulk operations on
   */
  bulkLimit?: number;
  className?: string;
};

function BulkNotice({
  selectedRowsCount,
  columnsCount,
  isPageSelected,
  isAllSelected,
  onSelectAllRows,
  onUnselectAllRows,
  bulkLimit,
  allRowsCount,
  className,
}: Props) {
  if ((allRowsCount && allRowsCount <= selectedRowsCount) || !isPageSelected) {
    return null;
  }

  const {noticeText, actionText} = getSelectAllText(allRowsCount, bulkLimit);

  return (
    <Wrapper columnsCount={columnsCount} className={className}>
      {isAllSelected ? (
        <Fragment>
          {noticeText}{' '}
          <AlertButton priority="link" onClick={onUnselectAllRows}>
            {t('Cancel selection.')}
          </AlertButton>
        </Fragment>
      ) : (
        <Fragment>
          {tn(
            '%s item on this page selected.',
            '%s items on this page selected.',
            selectedRowsCount
          )}{' '}
          <AlertButton priority="link" onClick={onSelectAllRows}>
            {actionText}
          </AlertButton>
        </Fragment>
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

const AlertButton = styled(Button)`
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
