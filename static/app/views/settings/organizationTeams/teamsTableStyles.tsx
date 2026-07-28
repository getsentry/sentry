import styled from '@emotion/styled';

import {Link} from '@sentry/scraps/link';

import {SimpleTable} from 'sentry/components/tables/simpleTable';

export const TeamsTable = styled(SimpleTable)`
  grid-template-columns: 1fr 125px 150px auto;
  margin-bottom: ${p => p.theme.space.xl};

  [data-column-name='actions'] {
    padding-left: 0;
  }

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: 1fr 125px auto;

    [data-column-name='projects'] {
      display: none;
    }
  }

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: 1fr auto;

    [data-column-name='role'] {
      display: none;
    }
  }
`;

export const TeamLink = styled(Link)`
  ${SimpleTable.rowLinkStyle}
`;
