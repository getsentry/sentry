import {CSSProperties, memo, useCallback} from 'react';
import styled from '@emotion/styled';

import BreadcrumbIcon from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type/icon';
import {PanelItem} from 'sentry/components/panels';
import {getDetails} from 'sentry/components/replays/breadcrumbs/utils';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import type {Crumb} from 'sentry/types/breadcrumbs';
import {getPrevReplayEvent} from 'sentry/utils/replays/getReplayEvent';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import IconWrapper from 'sentry/views/replays/detail/iconWrapper';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

interface Props {
  breadcrumb: Crumb;
  breadcrumbs: Crumb[];
  startTimestampMs: number;
  style: CSSProperties;
}

function BreadcrumbItem({breadcrumb, breadcrumbs, startTimestampMs, style}: Props) {
  const {title, description} = getDetails(breadcrumb);

  const {currentTime, currentHoverTime} = useReplayContext();

  const {handleMouseEnter, handleMouseLeave, handleClick} =
    useCrumbHandlers(startTimestampMs);

  const onClickTimestamp = useCallback(
    () => handleClick(breadcrumb),
    [handleClick, breadcrumb]
  );
  const onMouseEnter = useCallback(
    () => handleMouseEnter(breadcrumb),
    [handleMouseEnter, breadcrumb]
  );
  const onMouseLeave = useCallback(
    () => handleMouseLeave(breadcrumb),
    [handleMouseLeave, breadcrumb]
  );

  const current = getPrevReplayEvent({
    items: breadcrumbs,
    targetTimestampMs: startTimestampMs + currentTime,
    allowEqual: true,
    allowExact: true,
  });

  const hovered = currentHoverTime
    ? getPrevReplayEvent({
        items: breadcrumbs,
        targetTimestampMs: startTimestampMs + currentHoverTime,
        allowEqual: true,
        allowExact: true,
      })
    : undefined;

  const isCurrent = breadcrumb.id === current?.id;
  const isHovered = breadcrumb.id === hovered?.id;

  return (
    <CrumbItem
      aria-current={isCurrent}
      as="button"
      isHovered={isHovered}
      isSelected={isCurrent}
      onClick={onClickTimestamp}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={style}
    >
      <IconWrapper color={breadcrumb.color} hasOccurred>
        <BreadcrumbIcon type={breadcrumb.type} />
      </IconWrapper>
      <CrumbDetails>
        <TitleContainer>
          <Title>{title}</Title>
          <TimestampButton
            startTimestampMs={startTimestampMs}
            timestampMs={breadcrumb.timestamp || ''}
          />
        </TitleContainer>
        <Description title={description} showOnlyOnOverflow>
          {description}
        </Description>
      </CrumbDetails>
    </CrumbItem>
  );
}

const CrumbDetails = styled('div')`
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const TitleContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(1)};
`;

const Title = styled('span')`
  ${p => p.theme.overflowEllipsis};
  text-transform: capitalize;
  font-weight: 600;
  color: ${p => p.theme.gray400};
  line-height: ${p => p.theme.text.lineHeightBody};
`;

const Description = styled(Tooltip)`
  ${p => p.theme.overflowEllipsis};
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.subText};
`;

type CrumbItemProps = {
  isHovered: boolean;
  isSelected: boolean;
};

const CrumbItem = styled(PanelItem)<CrumbItemProps>`
  display: grid;
  grid-template-columns: max-content auto;
  align-items: flex-start;
  gap: ${space(1)};
  width: 100%;

  font-size: ${p => p.theme.fontSizeMedium};
  background: transparent;
  padding: ${space(1)};
  text-align: left;
  border: none;
  position: relative;

  ${p => p.isHovered && `background-color: ${p.theme.surface200};`}
  ${p => p.isSelected && `background-color: ${p.theme.purple100};`}
  &:hover {
    background-color: ${p => p.theme.surface200};
  }

  /* Draw a vertical line behind the breadcrumb icon. The line connects each row together, but is truncated for the first and last items */
  &::after {
    content: '';
    position: absolute;
    left: 19.5px;
    width: 1px;
    background: ${p => p.theme.gray200};
    height: 100%;
  }

  &:first-of-type::after {
    top: ${space(1)};
    bottom: 0;
  }

  &:last-of-type::after {
    top: 0;
    height: ${space(1)};
  }

  &:only-of-type::after {
    height: 0;
  }
`;

const MemoizedBreadcrumbItem = memo(BreadcrumbItem);

export default MemoizedBreadcrumbItem;
