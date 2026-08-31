import type {ComponentProps} from 'react';
import styled from '@emotion/styled';

import {Link} from '@sentry/scraps/link';
import type {TableColumnConfig} from '@sentry/scraps/table';

import {SimpleTable} from 'sentry/components/tables/simpleTable';

const TEAMS_TABLE_COLUMNS: TableColumnConfig[] = [
  {key: 'team', width: '1fr'},
  {key: 'role', visible: {zero: false, xl: true}, width: '125px'},
  {key: 'projects', visible: {zero: false, '3xl': true}, width: '150px'},
  {key: 'actions', width: 'auto'},
];

export function TeamsTable(props: ComponentProps<typeof StyledTeamsTable>) {
  return <StyledTeamsTable columns={TEAMS_TABLE_COLUMNS} {...props} />;
}

const StyledTeamsTable = styled(SimpleTable)`
  margin-bottom: ${p => p.theme.space.xl};

  [data-column-name='actions'] {
    padding-left: 0;
  }
`;

export const TeamLink = styled(Link)`
  ${SimpleTable.rowLinkStyle}
`;
