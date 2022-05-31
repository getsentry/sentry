import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import Type from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type';
import {
  Panel as BasePanel,
  PanelBody as BasePanelBody,
  PanelHeader as BasePanelHeader,
  PanelItem,
} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import ActionCategory from 'sentry/components/replays/actionCategory';
import PlayerRelativeTime from 'sentry/components/replays/playerRelativeTime';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {BreadcrumbType, Crumb} from 'sentry/types/breadcrumbs';
import {EventTransaction} from 'sentry/types/event';
import {getPrevBreadcrumb} from 'sentry/utils/replays/getBreadcrumb';

function CrumbPlaceholder({number}: {number: number}) {
  return (
    <Fragment>
      {[...Array(number)].map((_, i) => (
        <PlaceholderMargin key={i} height="40px" />
      ))}
    </Fragment>
  );
}

type Props = {
  /**
   * Raw breadcrumbs, `undefined` means it is still loading
   */
  crumbs: Crumb[] | undefined;
  /**
   * Root replay event, `undefined` means it is still loading
   */
  event: EventTransaction | undefined;
};

type ContainerProps = {
  isHovered: boolean;
  isSelected: boolean;
};

const USER_ACTIONS = [
  BreadcrumbType.ERROR,
  BreadcrumbType.INIT,
  BreadcrumbType.NAVIGATION,
  BreadcrumbType.UI,
  BreadcrumbType.USER,
];

function UserActionsNavigator({event, crumbs}: Props) {
  const {setCurrentTime, setCurrentHoverTime, currentHoverTime, currentTime} =
    useReplayContext();

  const startTimestamp = event?.startTimestamp || 0;
  const userActionCrumbs =
    crumbs?.filter(crumb => USER_ACTIONS.includes(crumb.type)) || [];

  const isLoaded = Boolean(event);

  const currentUserAction = getPrevBreadcrumb({
    crumbs: userActionCrumbs,
    targetTimestampMs: startTimestamp * 1000 + currentTime,
    allowExact: true,
  });

  const closestUserAction =
    currentHoverTime !== undefined
      ? getPrevBreadcrumb({
          crumbs: userActionCrumbs,
          targetTimestampMs: startTimestamp * 1000 + (currentHoverTime ?? 0),
          allowExact: true,
        })
      : undefined;

  const onMouseEnter = useCallback(
    (item: Crumb) => {
      if (startTimestamp) {
        setCurrentHoverTime(relativeTimeInMs(item.timestamp ?? '', startTimestamp));
      }
    },
    [setCurrentHoverTime, startTimestamp]
  );

  const onMouseLeave = useCallback(() => {
    setCurrentHoverTime(undefined);
  }, [setCurrentHoverTime]);

  return (
    <Panel>
      <PanelHeader>{t('Event Chapters')}</PanelHeader>

      <PanelBody>
        {!isLoaded && <CrumbPlaceholder number={4} />}
        {isLoaded &&
          userActionCrumbs.map(item => (
            <PanelItemCenter
              key={item.id}
              onMouseEnter={() => onMouseEnter(item)}
              onMouseLeave={() => onMouseLeave()}
            >
              <Container
                isHovered={closestUserAction?.id === item.id}
                isSelected={currentUserAction?.id === item.id}
                onClick={() =>
                  item.timestamp !== undefined
                    ? setCurrentTime(relativeTimeInMs(item.timestamp, startTimestamp))
                    : null
                }
              >
                <Wrapper>
                  <Type
                    type={item.type}
                    color={item.color}
                    description={item.description}
                  />
                  <ActionCategory action={item} />
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
  @media only screen and (max-width: ${p => p.theme.breakpoints[2]}) {
    height: fit-content;
    max-height: 400px;
    margin-top: ${space(2)};
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

const Container = styled('button')<ContainerProps>`
  display: inline-flex;
  width: 100%;
  border: none;
  background: transparent;
  justify-content: space-between;
  align-items: center;
  border-left: 4px solid transparent;
  padding: ${space(1)} ${space(1.5)};
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

const PlaceholderMargin = styled(Placeholder)`
  margin: ${space(1)} ${space(1.5)};
  width: auto;
`;

export default UserActionsNavigator;
