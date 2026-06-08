import styled from '@emotion/styled';

export const ResultTable = styled('table')`
  margin: 0;
  width: 100%;
  line-height: 1;

  thead th {
    font-size: ${p => p.theme.font.size.sm};
    text-transform: uppercase;
  }

  thead tr:last-child > th,
  tbody tr:not(:last-child) > td {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }

  th {
    padding: ${p => p.theme.space.xl} ${p => p.theme.space.lg};
  }

  td {
    padding: ${p => p.theme.space.lg} ${p => p.theme.space.lg};
  }

  th,
  td {
    &:first-of-type {
      padding-left: ${p => p.theme.space['2xl']};
    }
    &:last-child {
      padding-right: ${p => p.theme.space['2xl']};
    }
  }

  @media (max-width: 768px) {
    display: block;

    thead {
      display: none;
    }

    tbody {
      display: block;
    }

    /* Move row separator from td to tr */
    tbody tr:not(:last-child) > td {
      border-bottom: none;
    }

    tbody tr {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: ${p => p.theme.space.xl};
      row-gap: ${p => p.theme.space.sm};
      padding: ${p => p.theme.space.lg} ${p => p.theme.space['2xl']};
    }

    tbody tr:not(:last-child) {
      border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
    }

    /* ColSpan-only rows (loading, error, empty-state, collapsed expansion rows):
       bypass card grid layout so they don't render as empty padded strips. */
    tbody tr:has(> td[colspan]) {
      display: block;
      padding: 0;
      border-bottom: none;
    }

    /* All cells: reset padding and alignment */
    td {
      display: flex;
      flex-direction: column;
      gap: ${p => p.theme.space['2xs']};
      padding: 0;
      text-align: left !important;

      &:last-child {
        padding-right: 0;
      }
    }

    /* Primary cell spans full width, acts as card title.
       data-mobile-primary is injected by ResultGrid on the first non-control column;
       falls back to first-of-type for tables rendered without ResultGrid. */
    td[data-mobile-primary],
    tr:not(:has(td[data-mobile-primary])) > td:first-of-type {
      grid-column: 1 / -1;
      padding-left: 0;
      padding-bottom: ${p => p.theme.space.sm};
      border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
    }

    /* Secondary label styles: positions 2+ (and position 1 when it's a control cell
       and data-mobile-primary sits on a later column). */
    td:nth-of-type(n + 2):not([data-mobile-primary])::before {
      font-size: ${p => p.theme.font.size.xs};
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: ${p => p.theme.tokens.content.secondary};
    }

    /* Per-column label content. CSS vars (--cl-N set on <tr> by ResultGrid) are
       inherited by all descendants including ::before, so they work even when cells
       are rendered inside wrapper components. Falls back to data-label for tables
       rendered without ResultGrid (userEmails, billingPlans, invoiceDetails, etc.). */
    td:nth-of-type(2):not([data-mobile-primary])::before {
      content: var(--cl-2, attr(data-label));
    }
    td:nth-of-type(3):not([data-mobile-primary])::before {
      content: var(--cl-3, attr(data-label));
    }
    td:nth-of-type(4):not([data-mobile-primary])::before {
      content: var(--cl-4, attr(data-label));
    }
    td:nth-of-type(5):not([data-mobile-primary])::before {
      content: var(--cl-5, attr(data-label));
    }
    td:nth-of-type(6):not([data-mobile-primary])::before {
      content: var(--cl-6, attr(data-label));
    }
    td:nth-of-type(7):not([data-mobile-primary])::before {
      content: var(--cl-7, attr(data-label));
    }
    td:nth-of-type(8):not([data-mobile-primary])::before {
      content: var(--cl-8, attr(data-label));
    }
    td:nth-of-type(9):not([data-mobile-primary])::before {
      content: var(--cl-9, attr(data-label));
    }
    td:nth-of-type(10):not([data-mobile-primary])::before {
      content: var(--cl-10, attr(data-label));
    }
  }
`;
