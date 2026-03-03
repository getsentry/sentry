import styled from '@emotion/styled';

const ResultTable = styled('table')`
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
`;

export default ResultTable;
