import React, {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import Type from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type';
import {
  onlyUserActions,
  transformCrumbs,
} from 'sentry/components/events/interfaces/breadcrumbs/utils';
import {
  Panel as BasePanel,
  PanelBody as BasePanelBody,
  PanelHeader as BasePanelHeader,
  PanelItem,
} from 'sentry/components/panels';
import ActionCategory from 'sentry/components/replays/actionCategory';
import PlayerRelativeTime from 'sentry/components/replays/playerRelativeTime';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Crumb, RawCrumb} from 'sentry/types/breadcrumbs';
import {EventTransaction} from 'sentry/types/event';

type Props = {
  crumbs: Array<RawCrumb>;
  event: EventTransaction;
};

type PanelItemCenterProps = {
  isHovered?: boolean;
  isSelected?: boolean;
};

function UserActionsNavigator({event, crumbs}: Props) {
  const {setCurrentTime, currentHoverTime} = useReplayContext();
  const [currentUserAction, setCurrentUserAction] = useState<Crumb>();
  const [closestUserAction, setClosestUserAction] = useState<Crumb>();

  useEffect(() => {
    if (!currentHoverTime) {
      setClosestUserAction(undefined);
      return;
    }
    // TODO: Find a better way to find the closest user action without using `reduce` method
    const closestUserActionItem = userActionCrumbs.reduce((prev, curr) => {
      return Math.abs(
        relativeTimeInMs(curr.timestamp ?? '', startTimestamp) - currentHoverTime
      ) <
        Math.abs(
          relativeTimeInMs(prev.timestamp ?? '', startTimestamp) - currentHoverTime
        )
        ? curr
        : prev;
    });
    setClosestUserAction(closestUserActionItem);
  }, [currentHoverTime]);

  if (!event) {
    return null;
  }

  const {startTimestamp} = event;
  const userActionCrumbs = onlyUserActions(transformCrumbs(crumbs));

  return (
    <Panel>
      <PanelHeader>{t('Event Chapters')}</PanelHeader>

      <PanelBody>
        {userActionCrumbs.map(item => (
          <PanelItemCenter
            key={item.id}
            isHovered={closestUserAction && closestUserAction.id === item.id}
            isSelected={currentUserAction && currentUserAction.id === item.id}
            onClick={() => {
              setCurrentUserAction(item);
              item.timestamp
                ? setCurrentTime(relativeTimeInMs(item.timestamp, startTimestamp))
                : '';
            }}
          >
            <Wrapper>
              <Type type={item.type} color={item.color} description={item.description} />
              <ActionCategory category={item} />
            </Wrapper>
            <PlayerRelativeTime
              relativeTime={startTimestamp}
              timestamp={item.timestamp}
            />
          </PanelItemCenter>
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

const PanelItemCenter = styled(PanelItem)<PanelItemCenterProps>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-left: 4px solid transparent;
  padding: ${space(1)} ${space(1.5)};
  cursor: pointer;
  &:hover {
    background: ${p => p.theme.surface400};
    border-color: transparent;
  }
  ${p =>
    p.isHovered &&
    `background: ${p.theme.surface400};
        border-color: transparent;`}
  ${p =>
    p.isSelected &&
    `border-left: 4px solid ${p.theme.purple300};
          background-color: ${p.theme.surface400};`}
`;

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray500};
`;

export default UserActionsNavigator;
