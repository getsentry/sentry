import styled from '@emotion/styled';

export const Columns = styled('ul')<{remainder: number; totalColumns: number}>`
  /* Reset defaults for <ul> */
  list-style: none;
  margin: 0;
  padding: 0;

  height: 100%;
  width: 100%;

  /* Layout of the lines */
  display: grid;
  grid-template-columns: repeat(${p => p.totalColumns}, 1fr) ${p => p.remainder}fr;
  place-items: stretch;
`;

export const Col = styled('li')``;
