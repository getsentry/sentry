import React, {useCallback, useEffect, useState} from 'react';
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
import {getCurrentUserAction} from 'sentry/utils/replays/getCurrentUserAction';

type Props = {
  crumbs: RawCrumb[];
  event: EventTransaction;
};

type ContainerProps = {
  isHovered: boolean;
  isSelected: boolean;
};

function UserActionsNavigator({event, crumbs}: Props) {
  const {setCurrentTime, currentHoverTime} = useReplayContext();
  const [currentUserAction, setCurrentUserAction] = useState<Crumb>();
  const [closestUserAction, setClosestUserAction] = useState<Crumb>();

  const {startTimestamp} = event;
  const userActionCrumbs = onlyUserActions(transformCrumbs(crumbs));

  const getClosestUserAction = useCallback(
    async (hovertime: number) => {
      const closestUserActionItem = getCurrentUserAction(
        userActionCrumbs,
        startTimestamp,
        hovertime
      );
      if (closestUserAction?.timestamp !== closestUserActionItem.timestamp) {
        setClosestUserAction(closestUserActionItem);
      }
    },
    [closestUserAction?.timestamp, startTimestamp, userActionCrumbs]
  );

  useEffect(() => {
    getClosestUserAction(currentHoverTime);
  }, [getClosestUserAction, currentHoverTime]);

  if (!event) {
    return null;
  }

  return (
    <Panel>
      <PanelHeader>{t('Event Chapters')}</PanelHeader>

      <PanelBody>
        {userActionCrumbs.map(item => (
          <PanelItemCenter
            key={item.id}
            onClick={() => {
              setCurrentUserAction(item);
              item.timestamp
                ? setCurrentTime(relativeTimeInMs(item.timestamp, startTimestamp))
                : '';
            }}
          >
            <Container
              isHovered={closestUserAction?.id === item.id}
              isSelected={currentUserAction?.id === item.id}
            >
              <Wrapper>
                <Type
                  type={item.type}
                  color={item.color}
                  description={item.description}
                />
                <ActionCategory category={item} />
              </Wrapper>
              <PlayerRelativeTime
                relativeTime={startTimestamp}
                timestamp={item.timestamp}
              />
            </Container>
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

const PanelItemCenter = styled(PanelItem)`
  display: block;
  padding: ${space(0)};
  cursor: pointer;
`;

const Container = styled('div')<ContainerProps>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-left: 4px solid transparent;
  padding: ${space(1)} ${space(1.5)};
  &:hover {
    background: ${p => p.theme.surface400};
  }
  ${p => p.isHovered && `background: ${p.theme.surface400};`}
  ${p => p.isSelected && `border-left: 4px solid ${p.theme.purple300};`}
`;

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray500};
`;

export default UserActionsNavigator;
