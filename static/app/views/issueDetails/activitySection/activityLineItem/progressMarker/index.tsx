import styled from '@emotion/styled';

import type {GroupActivity} from 'sentry/types/group';

import {ProgressMarker} from './progressMarker';
import {getProgressMarkerVariant} from './variant';

export function ActivityLineMarker({item}: {item: GroupActivity}) {
  return (
    <MarkerCell>
      <ProgressMarker variant={getProgressMarkerVariant(item)} />
    </MarkerCell>
  );
}

const MarkerCell = styled('div')`
  grid-column: 1;
  grid-row: 1;
  display: grid;
  place-items: center;
  min-width: 22px;
  min-height: 22px;
`;
