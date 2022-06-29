import {memo, useCallback} from 'react';
import styled from '@emotion/styled';

import BreadcrumbIcon from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type/icon';
import {PanelItem} from 'sentry/components/panels';
import {getDetails} from 'sentry/components/replays/breadcrumbs/utils';
import PlayerRelativeTime from 'sentry/components/replays/playerRelativeTime';
import {SVGIconProps} from 'sentry/icons/svgIcon';
import space from 'sentry/styles/space';
import type {Crumb} from 'sentry/types/breadcrumbs';

type MouseCallback = (crumb: Crumb, e: React.MouseEvent<HTMLElement>) => void;

interface Props {
  crumb: Crumb;
  isHovered: boolean;
  isSelected: boolean;
  onClick: MouseCallback;
  onMouseEnter: MouseCallback;
  onMouseLeave: MouseCallback;
  startTimestamp: number;
}

function BreadcrumbItem({
  crumb,
  isHovered,
  isSelected,
  startTimestamp,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: Props) {
  const {title, description} = getDetails(crumb);

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLElement>) => onMouseEnter(crumb, e),
    [onMouseEnter, crumb]
  );
  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLElement>) => onMouseLeave(crumb, e),
    [onMouseLeave, crumb]
  );
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => onClick(crumb, e),
    [onClick, crumb]
  );

  return (
    <CrumbItem
      as="button"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      isHovered={isHovered}
      isSelected={isSelected}
      aria-current={isSelected}
    >
      <IconWrapper color={crumb.color}>
        <BreadcrumbIcon type={crumb.type} />
      </IconWrapper>
      <CrumbDetails>
        <Title>{title}</Title>
        <Description title={description}>{description}</Description>
      </CrumbDetails>
      <PlayerRelativeTime relativeTime={startTimestamp} timestamp={crumb.timestamp} />
    </CrumbItem>
  );
}

const CrumbDetails = styled('div')`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  line-height: 1.2;
  padding: ${space(1)} 0;
`;

const Title = styled('span')`
  ${p => p.theme.overflowEllipsis};
  text-transform: capitalize;
`;

const Description = styled('span')`
  ${p => p.theme.overflowEllipsis};
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
`;

type CrumbItemProps = {
  isHovered: boolean;
  isSelected: boolean;
};

const CrumbItem = styled(PanelItem)<CrumbItemProps>`
  display: grid;
  grid-template-columns: max-content max-content auto max-content;
  align-items: center;
  gap: ${space(1)};
  width: 100%;

  font-size: ${p => p.theme.fontSizeMedium};
  background: transparent;
  padding: 0;
  padding-right: ${space(1)};
  text-align: left;

  border: none;
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  ${p => p.isHovered && `background: ${p.theme.surface400};`}

  /* overrides PanelItem css */
  &:last-child {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }

  /* Selected state */
  ::before {
    content: '';
    width: 4px;
    height: 100%;
    ${p => p.isSelected && `background-color: ${p.theme.purple300};`}
  }
`;

/**
 * Taken `from events/interfaces/.../breadcrumbs/types`
 */
const IconWrapper = styled('div')<Required<Pick<SVGIconProps, 'color'>>>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: ${p => p.theme.white};
  background: ${p => p.theme[p.color] ?? p.color};
  box-shadow: ${p => p.theme.dropShadowLightest};
  position: relative;
`;

const MemoizedBreadcrumbItem = memo(BreadcrumbItem);

export default MemoizedBreadcrumbItem;
