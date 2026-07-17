import styled from '@emotion/styled';

import type {GroupActivity} from 'sentry/types/group';

import {ActivityProgressMarker} from './progressMarker';
import {getActivityMarkerState} from './variant';

export function ActivityLineMarker({item}: {item: GroupActivity}) {
  return (
    <MarkerCell>
      <ActivityProgressMarker state={getActivityMarkerState(item)} />
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
  margin-top: -2px;
`;
