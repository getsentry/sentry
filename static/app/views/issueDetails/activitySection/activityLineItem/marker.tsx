import styled from '@emotion/styled';

import {Grid} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import type {GroupActivity} from 'sentry/types/group';

import {renderActivityLineActor} from './actor';

export function ActivityLineMarker({item}: {item: GroupActivity}) {
  return <MarkerCell>{renderActivityLineActor(item) ?? <ActivityLineDot />}</MarkerCell>;
}

export function ActivityLineDotMarker() {
  return (
    <MarkerCell>
      <ActivityLineDot />
    </MarkerCell>
  );
}

function ActivityLineDot() {
  return <NeutralLineDot aria-label={t('Activity update')} role="img" />;
}

function MarkerCell({children}: {children: React.ReactNode}) {
  return (
    // Markers center in the first 22px over the timeline. The extra 2px leaves
    // room for an avatar with a source logo beside it.
    <Grid
      position="relative"
      top="-2px"
      column="1"
      row="1"
      align="center"
      justifyItems="center"
      width="24px"
      minHeight="22px"
      paddingRight="2xs"
    >
      {children}
    </Grid>
  );
}

const NeutralLineDot = styled('span')`
  width: 8px;
  height: 8px;
  border-radius: 100%;
  background: ${p => p.theme.tokens.graphics.neutral.moderate};
  /* oxlint-disable-next-line @sentry/scraps/use-semantic-token */
  box-shadow: 0 0 0 4px ${p => p.theme.tokens.background.primary};
`;
