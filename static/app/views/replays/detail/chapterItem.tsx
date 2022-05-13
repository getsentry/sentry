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
  isHovered: boolean;
  isSelected: boolean;
  item: Crumb;
  startTimestamp: number;
};

function ChapterItem({item, isHovered, isSelected, startTimestamp}: Props) {
  const {setCurrentTime, setCurrentHoverTime} = useReplayContext();

  const timestamp = relativeTimeInMs(item.timestamp ?? '', startTimestamp);

  const onMouseEnter = useCallback(() => {
    setCurrentHoverTime(timestamp);
  }, [setCurrentHoverTime, timestamp]);

  const onMouseLeave = useCallback(() => {
    setCurrentHoverTime(undefined);
  }, [setCurrentHoverTime]);

  const onClick = useCallback(() => {
    setCurrentTime(timestamp);
  }, [setCurrentTime, timestamp]);

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
          <Type type={item.type} color={item.color} description={item.description} />
          <ActionCategory category={item} />
        </Wrapper>
        <PlayerRelativeTime relativeTime={startTimestamp} timestamp={item.timestamp} />
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
  background: transparent;
  border: none;
  border-left: 4px solid transparent;
  padding: ${space(1)} ${space(1.5)};
  :hover {
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

export default ChapterItem;
