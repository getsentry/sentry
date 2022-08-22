import styled from '@emotion/styled';

/**
 * Use grid to create columns that we can place child nodes into.
 * Leveraging grid for alignment means we don't need to calculate percent offset
 * nor use position:absolute to lay out items.
 *
 * <Columns>
 *   <Col>...</Col>
 *   <Col>...</Col>
 * </Columns>
 */
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

// Export an empty component which so that callsites can correctly nest nodes:
export const Col = styled('li')``;
