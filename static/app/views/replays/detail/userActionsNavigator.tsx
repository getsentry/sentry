import React from 'react';
import styled from '@emotion/styled';

import {
  onlyUserActions,
  transformCrumbs,
} from 'sentry/components/events/interfaces/breadcrumbs/utils';
import {
  Panel as BasePanel,
  PanelBody as BasePanelBody,
  PanelHeader as BasePanelHeader,
} from 'sentry/components/panels';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {RawCrumb} from 'sentry/types/breadcrumbs';
import {EventTransaction} from 'sentry/types/event';
import {getCurrentUserAction} from 'sentry/utils/replays/getCurrentUserAction';

import ChapterItem from './chapterItem';

type Props = {
  crumbs: RawCrumb[];
  event: EventTransaction;
};

function UserActionsNavigator({event, crumbs}: Props) {
  const {currentHoverTime, currentTime} = useReplayContext();

  const {startTimestamp} = event;
  const userActionCrumbs = onlyUserActions(transformCrumbs(crumbs));

  const hoveredAction =
    currentHoverTime !== undefined
      ? getCurrentUserAction(userActionCrumbs, startTimestamp, currentHoverTime)
      : undefined;

  const selectedAction =
    currentTime !== undefined
      ? getCurrentUserAction(userActionCrumbs, startTimestamp, currentTime)
      : undefined;

  return (
    <Panel>
      <PanelHeader>{t('Event Chapters')}</PanelHeader>

      <PanelBody>
        {userActionCrumbs.map(crumb => (
          <ChapterItem
            key={crumb.id}
            crumb={crumb}
            isHovered={hoveredAction?.id === crumb.id}
            isSelected={selectedAction?.id === crumb.id}
            startTimestamp={startTimestamp}
          />
        ))}
      </PanelBody>
    </Panel>
  );
}

// FYI: Since the Replay Player has dynamic height based
// on the width of the window,
// height: 0; will helps us to reset the height
// min-height: 100%; will helps us to grow at the same height of Player
const Panel = styled(BasePanel)`
  width: 100%;
  display: grid;
  grid-template-rows: auto 1fr;
  height: 0;
  min-height: 100%;
  @media only screen and (max-width: ${p => p.theme.breakpoints[1]}) {
    min-height: 450px;
  }
`;

const PanelHeader = styled(BasePanelHeader)`
  background-color: ${p => p.theme.white};
  border-bottom: none;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  text-transform: capitalize;
  padding: ${space(1.5)} ${space(2)} ${space(0.5)};
`;

const PanelBody = styled(BasePanelBody)`
  overflow-y: auto;
`;

export default UserActionsNavigator;
