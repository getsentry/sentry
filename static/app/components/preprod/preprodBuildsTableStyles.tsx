import styled from '@emotion/styled';

import {Link} from '@sentry/scraps/link';

import {SimpleTable} from 'sentry/components/tables/simpleTable';

interface BuildsTableTracks {
  withProject: string;
  withoutProject: string;
}

export const BuildsTableGrid = styled(SimpleTable, {
  shouldForwardProp: prop => prop !== 'tracks' && prop !== 'showProjectColumn',
})<{tracks: BuildsTableTracks; showProjectColumn?: boolean}>`
  overflow: auto;
  grid-template-columns: ${p =>
    p.showProjectColumn ? p.tracks.withProject : p.tracks.withoutProject};
`;

export const FullRowLink = styled(Link)`
  cursor: pointer;
  color: inherit;

  &:hover {
    color: inherit;
  }

  &::before {
    content: '';
    position: absolute;
    inset: 0;
  }
`;
