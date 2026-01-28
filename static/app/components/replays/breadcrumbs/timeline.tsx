import styled from '@emotion/styled';

import {Container, type ContainerProps} from '@sentry/scraps/layout';

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
  pointer-events: none;

  /* Reset defaults for <ul> */
  list-style: none;
  margin: 0;
  padding: 0;

  /* Layout of the lines */
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(${p => p.totalColumns}, 1fr) ${p => p.remainder}fr;
`;

// Export an empty component which so that callsites can correctly nest nodes:
export function Col(props: ContainerProps<'li'>) {
  return <Container as="li" {...props} />;
}
