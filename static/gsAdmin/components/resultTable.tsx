import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const ResultTable = styled('table')`
  margin: 0;
  width: 100%;
  line-height: 1;

  thead th {
    font-size: ${p => p.theme.fontSize.sm};
    text-transform: uppercase;
  }

  thead tr:last-child > th,
  tbody tr:not(:last-child) > td {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }

  th {
    padding: ${space(2)} ${space(1.5)};
  }

  td {
    padding: ${space(1.5)} ${space(1.5)};
  }

  th,
  td {
    &:first-of-type {
      padding-left: ${space(3)};
    }
    &:last-child {
      padding-right: ${space(3)};
    }
  }
`;

export default ResultTable;
