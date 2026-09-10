import styled from '@emotion/styled';

import {Flex, type FlexProps} from '@sentry/scraps/layout';
import {TABLE_HEAD_ROW_HEIGHT} from '@sentry/scraps/table';

import {DataTable} from 'sentry/components/tables/dataTable';

export function Header(props: FlexProps) {
  return <Flex justify="between" align="center" marginBottom="md" {...props} />;
}

export const HeaderTitle = styled('h4')`
  margin: 0;
  font-size: ${p => p.theme.font.size.md};
  color: ${p => p.theme.tokens.content.secondary};
`;

export const HeaderButtonContainer = styled('div')`
  display: grid;
  gap: ${p => p.theme.space.md};
  grid-auto-flow: column;
  grid-auto-columns: auto;
  justify-items: end;

  /* Hovercard anchor element when features are disabled. */
  & > span {
    display: flex;
    flex-direction: row;
  }
`;

/**
 * Create spacing/padding similar to GridHeadCellWrapper but
 * without interactive aspects.
 */
export const GridHeadCellStatic = styled('th')`
  height: ${TABLE_HEAD_ROW_HEIGHT}px;
  display: flex;
  align-items: center;
  padding: 0 ${p => p.theme.space.xl};
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  justify-content: center;

  &:first-child {
    padding: ${p => `${p.theme.space.md} 0 ${p.theme.space.md} ${p.theme.space['2xl']}`};
  }
`;

export const GridBodyCellStatic = styled(DataTable.Cell)`
  /* Need to select the 2nd child to select the first cell
     as the first child is the interaction state layer */
  &:nth-child(2) {
    padding: ${p => `${p.theme.space.md} 0 ${p.theme.space.md} ${p.theme.space['2xl']}`};
  }
`;
