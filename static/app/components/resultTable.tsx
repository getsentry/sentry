import styled from '@emotion/styled';

/**
 * The cell that names its row. On narrow containers it becomes the title of
 * the row's card, above the row's labelled `data-label` cells.
 */
export function ResultTableRowHeader(props: React.ComponentProps<'th'>) {
  return <RowHeader scope="row" {...props} />;
}

const RowHeader = styled('th')`
  font-weight: inherit;
`;

export const ResultTable = styled('table')`
  margin: 0;
  width: 100%;
  line-height: 1;

  thead,
  tbody tr:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }

  tbody small {
    font-size: ${p => p.theme.font.size.xs};
  }

  tbody br + small {
    display: inline-block;
    margin-top: ${p => p.theme.space.xs};
  }

  @container (width > ${p => p.theme.container.xl}) {
    thead th {
      font-size: ${p => p.theme.font.size.sm};
      text-transform: uppercase;
      padding: ${p => p.theme.space.xl} ${p => p.theme.space.lg};
    }

    td,
    ${RowHeader} {
      padding: ${p => p.theme.space.lg};
    }

    th,
    td {
      &:first-child {
        padding-left: ${p => p.theme.space['2xl']};
      }
      &:last-child {
        padding-right: ${p => p.theme.space['2xl']};
      }
    }
  }

  @container (width <= ${p => p.theme.container.xl}) {
    display: block;

    thead {
      display: none;
    }

    tbody {
      display: block;
    }

    tr {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: ${p => p.theme.space.xl};
      row-gap: ${p => p.theme.space.sm};
      padding: ${p => p.theme.space.lg} ${p => p.theme.space['2xl']};
    }

    /* ColSpan-only rows (loading, error, empty-state):
       bypass card grid layout so they don't render as empty padded strips. */
    tr:has(> td[colspan]) {
      display: block;
      padding: 0;
    }

    td {
      display: flex;
      flex-direction: column;
      gap: ${p => p.theme.space['2xs']};
      text-align: left !important;

      /* The column already stacks children; a <br> would become a blank flex item. */
      > br {
        display: none;
      }
    }

    ${RowHeader} {
      grid-column: 1 / -1;
      padding-bottom: ${p => p.theme.space.sm};
      border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
    }

    td[data-label]::before {
      content: attr(data-label);
      font-size: ${p => p.theme.font.size.xs};
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: ${p => p.theme.tokens.content.secondary};
    }
  }
`;
