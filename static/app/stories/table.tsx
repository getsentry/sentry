import styled from '@emotion/styled';

export const StoryTable = styled('table')`
  min-width: 0;
  flex-grow: 1;
  margin: 1px;
  padding: 0;
  width: calc(100% - 2px);
  table-layout: auto;
  border: 0;
  border-collapse: collapse;
  border-radius: ${p => p.theme.radius.md};
  box-shadow: 0 0 0 1px ${p => p.theme.tokens.border.primary};
  margin-bottom: ${p => p.theme.space['3xl']};

  & thead {
    height: 36px;
    border-radius: ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0 0;
    background: ${p => p.theme.tokens.background.tertiary};
    border-bottom: 4px solid ${p => p.theme.tokens.border.primary};
  }

  & th {
    padding-inline: ${p => p.theme.space.xl};
    padding-block: ${p => p.theme.space.sm};

    &:first-of-type {
      border-radius: ${p => p.theme.radius.md} 0 0 0;
    }
    &:last-of-type {
      border-radius: 0 ${p => p.theme.radius.md} 0 0;
    }
  }

  tr:last-child td:first-of-type {
    border-radius: 0 0 0 ${p => p.theme.radius.md};
  }
  tr:last-child td:last-of-type {
    border-radius: 0 0 ${p => p.theme.radius.md} 0;
  }

  tbody {
    background: ${p => p.theme.tokens.background.primary};
    border-radius: 0 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md};
  }

  tr {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
    vertical-align: baseline;

    &:last-child {
      border-bottom: 0;
    }
  }

  td:first-child {
    white-space: nowrap;
    word-break: break-all;
    hyphens: none;
  }

  td {
    padding-inline: ${p => p.theme.space.xl};
    padding-block: ${p => p.theme.space.lg};
  }
`;
