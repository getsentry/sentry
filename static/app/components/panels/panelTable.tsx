import {forwardRef} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import Panel from './panel';

export type PanelTableProps = {
  /**
   * Headers of the table.
   */
  headers: React.ReactNode[];
  /**
   * The body of the table. Make sure the number of children elements are
   * multiples of the length of headers.
   */
  children?: React.ReactNode | (() => React.ReactNode);
  className?: string;
  /**
   * Renders without predefined padding on the header and body cells
   */
  disablePadding?: boolean;
  /**
   * Action to display when isEmpty is true
   */
  emptyAction?: React.ReactNode;
  /**
   * Message to use for `<EmptyStateWarning>`
   */
  emptyMessage?: React.ReactNode;
  /**
   * Displays an `<EmptyStateWarning>` if true
   */
  isEmpty?: boolean;
  /**
   * If this is true, then display a loading indicator
   */
  isLoading?: boolean;
  /**
   * A custom loading indicator.
   */
  loader?: React.ReactNode;
  /**
   * If true, scrolling headers out of view will pin to the top of container.
   */
  stickyHeaders?: boolean;
};

/**
 * Bare bones table generates a CSS grid template based on the content.
 *
 * The number of children elements should be a multiple of `this.props.columns` to have
 * it look ok.
 *
 *
 * Potential customizations:
 * - [ ] Add borders for columns to make them more like cells
 * - [ ] Add prop to disable borders for rows
 * - [ ] We may need to wrap `children` with our own component (similar to what we're doing
 *       with `headers`. Then we can get rid of that gross `> *` selector
 * - [ ] Allow customization of wrappers (Header and body cells if added)
 */

const PanelTable = forwardRef<HTMLDivElement, PanelTableProps>(function PanelTable(
  {
    headers,
    children,
    isLoading,
    isEmpty,
    disablePadding,
    className,
    emptyMessage = t('There are no items to display'),
    emptyAction,
    loader,
    stickyHeaders = false,
    ...props
  }: PanelTableProps,
  ref: React.Ref<HTMLDivElement>
) {
  const shouldShowLoading = isLoading === true;
  const shouldShowEmptyMessage = !shouldShowLoading && isEmpty;
  const shouldShowContent = !shouldShowLoading && !shouldShowEmptyMessage;

  return (
    <Wrapper
      ref={ref}
      columns={headers.length}
      disablePadding={disablePadding}
      className={className}
      hasRows={shouldShowContent}
      {...props}
    >
      {headers.map((header, i) => (
        <PanelTableHeader key={i} sticky={stickyHeaders} data-test-id="table-header">
          {header}
        </PanelTableHeader>
      ))}

      {shouldShowLoading && (
        <LoadingWrapper>{loader || <LoadingIndicator />}</LoadingWrapper>
      )}

      {shouldShowEmptyMessage && (
        <TableEmptyStateWarning>
          <p>{emptyMessage}</p>
          {emptyAction}
        </TableEmptyStateWarning>
      )}

      {shouldShowContent && getContent(children)}
    </Wrapper>
  );
});

function getContent(children: PanelTableProps['children']) {
  if (typeof children === 'function') {
    return children();
  }

  return children;
}

type WrapperProps = {
  /**
   * The number of columns the table will have, this is derived from the headers list
   */
  columns: number;
  disablePadding: PanelTableProps['disablePadding'];
  hasRows: boolean;
};

const LoadingWrapper = styled('div')``;

const TableEmptyStateWarning = styled(EmptyStateWarning)``;

const Wrapper = styled(Panel, {
  shouldForwardProp: p => typeof p === 'string' && isPropValid(p) && p !== 'columns',
})<WrapperProps>`
  display: grid;
  grid-template-columns: repeat(${p => p.columns}, auto);

  > * {
    ${p => (p.disablePadding ? '' : `padding: ${space(2)};`)}

    &:nth-last-child(n + ${p => (p.hasRows ? p.columns + 1 : 0)}) {
      border-bottom: 1px solid ${p => p.theme.border};
    }
  }

  > ${TableEmptyStateWarning}, > ${LoadingWrapper} {
    border: none;
    grid-column: auto / span ${p => p.columns};
  }

  /* safari needs an overflow value or the contents will spill out */
  overflow: auto;
`;

export const PanelTableHeader = styled('div')<{sticky: boolean}>`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  text-transform: uppercase;
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  background: ${p => p.theme.backgroundSecondary};
  line-height: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 45px;

  ${p =>
    p.sticky &&
    `
    position: sticky;
    top: 0;
    z-index: ${p.theme.zIndex.initial};
  `}
`;

export default PanelTable;
