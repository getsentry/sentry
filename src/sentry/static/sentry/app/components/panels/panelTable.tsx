import * as React from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import LoadingIndicator from 'app/components/loadingIndicator';
import space from 'app/styles/space';

import Panel from './panel';

type Props = {
  /**
   * Headers of the table.
   */
  headers: React.ReactNode[];

  /**
   * The body of the table. Make sure the number of children elements are
   * multiples of the length of headers.
   */
  children: React.ReactNode | (() => React.ReactNode);

  /**
   * If this is true, then display a loading indicator
   */
  isLoading?: boolean;

  /**
   * Displays an `<EmptyStateWarning>` if true
   */
  isEmpty?: boolean;

  /**
   * Message to use for `<EmptyStateWarning>`
   */
  emptyMessage?: React.ReactNode;

  /**
   * Renders without predefined padding on the header and body cells
   */
  disablePadding?: boolean;

  className?: string;

  /**
   * A custom loading indicator.
   */
  loader?: React.ReactNode;
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
const PanelTable = ({
  headers,
  children,
  isLoading,
  isEmpty,
  disablePadding,
  className,
  emptyMessage = t('There are no items to display'),
  loader,
}: Props) => {
  const shouldShowLoading = isLoading === true;
  const shouldShowEmptyMessage = !shouldShowLoading && isEmpty;
  const shouldShowContent = !shouldShowLoading && !shouldShowEmptyMessage;

  return (
    <Wrapper
      columns={headers.length}
      disablePadding={disablePadding}
      className={className}
      hasRows={shouldShowContent}
    >
      {headers.map((header, i) => (
        <PanelTableHeader key={i}>{header}</PanelTableHeader>
      ))}

      {shouldShowLoading && (
        <LoadingWrapper>{loader || <LoadingIndicator />}</LoadingWrapper>
      )}

      {shouldShowEmptyMessage && (
        <TableEmptyStateWarning>
          <p>{emptyMessage}</p>
        </TableEmptyStateWarning>
      )}

      {shouldShowContent && getContent(children)}
    </Wrapper>
  );
};

function getContent(children: Props['children']) {
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
  hasRows: boolean;
  disablePadding: Props['disablePadding'];
};

const LoadingWrapper = styled('div')``;

const TableEmptyStateWarning = styled(EmptyStateWarning)``;

const Wrapper = styled(Panel, {
  shouldForwardProp: p => isPropValid(p) && p !== 'columns',
})<WrapperProps>`
  display: grid;
  grid-template-columns: repeat(${p => p.columns}, auto);

  > * {
    ${p => (p.disablePadding ? '' : `padding: ${space(2)};`)}

    &:nth-last-child(n + ${p => (p.hasRows ? p.columns + 1 : 0)}) {
      border-bottom: 1px solid ${p => p.theme.borderDark};
    }
  }

  > ${/* sc-selector */ TableEmptyStateWarning}, > ${/* sc-selector */ LoadingWrapper} {
    border: none;
    grid-column: auto / span ${p => p.columns};
  }

  /* safari needs an overflow value or the contents will spill out */
  overflow: auto;
`;

export const PanelTableHeader = styled('div')`
  color: ${p => p.theme.gray600};
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  background: ${p => p.theme.gray100};
  line-height: 1;
`;

export default PanelTable;
