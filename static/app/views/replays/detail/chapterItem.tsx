import React, {useCallback} from 'react';
import styled from '@emotion/styled';

import Type from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type';
import {PanelItem as BasePanelItem} from 'sentry/components/panels';
import ActionCategory from 'sentry/components/replays/actionCategory';
import PlayerRelativeTime from 'sentry/components/replays/playerRelativeTime';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import space from 'sentry/styles/space';
import {Crumb} from 'sentry/types/breadcrumbs';

type Props = {
  crumb: Crumb;
  isHovered: boolean;
  isSelected: boolean;
  startTimestamp: number;
};

function ChapterItem({crumb, isHovered, isSelected, startTimestamp}: Props) {
  const {setCurrentTime, setCurrentHoverTime} = useReplayContext();

  const onMouseEnter = useCallback(() => {
    const timestamp = relativeTimeInMs(crumb.timestamp ?? '', startTimestamp);
    setCurrentHoverTime(timestamp);
  }, [setCurrentHoverTime, crumb.timestamp, startTimestamp]);

  const onMouseLeave = useCallback(() => {
    setCurrentHoverTime(undefined);
  }, [setCurrentHoverTime]);

  const onClick = useCallback(() => {
    const timestamp = relativeTimeInMs(crumb.timestamp ?? '', startTimestamp);
    setCurrentTime(timestamp);
  }, [setCurrentTime, crumb.timestamp, startTimestamp]);

  return (
    <PanelItem>
      <CrumbItem
        isHovered={isHovered}
        isSelected={isSelected}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      >
        <Wrapper>
          <Type type={crumb.type} color={crumb.color} description={crumb.description} />
          <ActionCategory crumb={crumb} />
        </Wrapper>
        <PlayerRelativeTime relativeTime={startTimestamp} timestamp={crumb.timestamp} />
      </CrumbItem>
    </PanelItem>
  );
}

const PanelItem = styled(BasePanelItem)`
  display: block;
  padding: ${space(0)};
`;

const CrumbItem = styled('button')<Pick<Props, 'isHovered' | 'isSelected'>>`
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(1.5)} ${space(1)} ${space(1)};
  border: none;
  border-left: 4px solid ${p => (p.isSelected ? p.theme.purple300 : 'transparent')};
  background: ${p => (p.isHovered ? p.theme.surface400 : 'transparent')};
`;

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray500};
`;

export default ChapterItem;
