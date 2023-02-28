import {memo, useCallback} from 'react';
import styled from '@emotion/styled';

import BreadcrumbIcon from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type/icon';
import {PanelItem} from 'sentry/components/panels';
import {getDetails} from 'sentry/components/replays/breadcrumbs/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {SVGIconProps} from 'sentry/icons/svgIcon';
import {space} from 'sentry/styles/space';
import type {Crumb} from 'sentry/types/breadcrumbs';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

type MouseCallback = (crumb: Crumb, e: React.MouseEvent<HTMLElement>) => void;

interface Props {
  crumb: Crumb;
  isHovered: boolean;
  isSelected: boolean;
  onClick: null | MouseCallback;
  startTimestampMs: number;
  allowHover?: boolean;
  onMouseEnter?: MouseCallback;
  onMouseLeave?: MouseCallback;
}

function BreadcrumbItem({
  crumb,
  isHovered,
  isSelected,
  startTimestampMs,
  allowHover = true,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: Props) {
  const {title, description} = getDetails(crumb);

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLElement>) => onMouseEnter && onMouseEnter(crumb, e),
    [onMouseEnter, crumb]
  );
  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLElement>) => onMouseLeave && onMouseLeave(crumb, e),
    [onMouseLeave, crumb]
  );
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      onClick?.(crumb, e);
    },
    [crumb, onClick]
  );

  return (
    <CrumbItem
      as={onClick ? 'button' : 'span'}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      isHovered={isHovered}
      isSelected={isSelected}
      aria-current={isSelected}
      allowHover={allowHover}
    >
      <IconWrapper color={crumb.color}>
        <BreadcrumbIcon type={crumb.type} />
      </IconWrapper>
      <CrumbDetails>
        <TitleContainer>
          <Title>{title}</Title>
          {onClick ? (
            <TimestampButton
              startTimestampMs={startTimestampMs}
              timestampMs={crumb.timestamp || ''}
            />
          ) : null}
        </TitleContainer>

        <Tooltip title={description} showOnlyOnOverflow>
          <Description>{description}</Description>
        </Tooltip>
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

const Description = styled('span')`
  ${p => p.theme.overflowEllipsis};
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.subText};
`;

type CrumbItemProps = {
  isHovered: boolean;
  isSelected: boolean;
  allowHover?: boolean;
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
  ${p => p.isSelected && `background-color: ${p.theme.purple100};`}
  ${p => p.isHovered && `background-color: ${p.theme.surface200};`}
  border-radius: ${p => p.theme.borderRadius};

  ${p =>
    p.allowHover &&
    ` &:hover {
    background-color: ${p.theme.surface200};
  }`}

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

/**
 * Taken `from events/interfaces/.../breadcrumbs/types`
 */
const IconWrapper = styled('div')<Required<Pick<SVGIconProps, 'color'>>>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: ${p => p.theme.white};
  background: ${p => p.theme[p.color] ?? p.color};
  box-shadow: ${p => p.theme.dropShadowLight};
  position: relative;
  z-index: ${p => p.theme.zIndex.initial};
`;

const MemoizedBreadcrumbItem = memo(BreadcrumbItem);

export default MemoizedBreadcrumbItem;
