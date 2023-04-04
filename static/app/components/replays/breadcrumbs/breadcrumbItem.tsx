import {CSSProperties, memo, MouseEvent, useCallback} from 'react';
import styled from '@emotion/styled';

import BreadcrumbIcon from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type/icon';
import ObjectInspector from 'sentry/components/objectInspector';
import {PanelItem} from 'sentry/components/panels';
import {getDetails} from 'sentry/components/replays/breadcrumbs/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import type {Crumb} from 'sentry/types/breadcrumbs';
import IconWrapper from 'sentry/views/replays/detail/iconWrapper';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

type MouseCallback = (crumb: Crumb, e: React.MouseEvent<HTMLElement>) => void;

interface BaseProps {
  crumb: Crumb;
  isCurrent: boolean;
  isHovered: boolean;
  onClick: null | MouseCallback;
  startTimestampMs: number;
  expandPaths?: string[];
  onMouseEnter?: MouseCallback;
  onMouseLeave?: MouseCallback;
  style?: CSSProperties;
}
interface NoDimensionChangeProps extends BaseProps {
  index?: undefined;
  onDimensionChange?: undefined;
}

interface WithDimensionChangeProps extends BaseProps {
  /**
   * Only required if onDimensionChange is used
   */
  index: number;
  onDimensionChange: (
    index: number,
    path: string,
    expandedState: Record<string, boolean>,
    event: MouseEvent<HTMLDivElement>
  ) => void;
}

type Props = NoDimensionChangeProps | WithDimensionChangeProps;

function BreadcrumbItem({
  crumb,
  expandPaths,
  index,
  isCurrent,
  isHovered,
  onClick,
  onDimensionChange,
  onMouseEnter,
  onMouseLeave,
  startTimestampMs,
  style,
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
  const handleDimensionChange = useCallback(
    (path, expandedState, e) =>
      onDimensionChange && onDimensionChange(index, path, expandedState, e),
    [index, onDimensionChange]
  );

  return (
    <CrumbItem
      aria-current={isCurrent}
      as={onClick ? 'button' : 'span'}
      isCurrent={isCurrent}
      isHovered={isHovered}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={style}
    >
      <IconWrapper color={crumb.color} hasOccurred>
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

        {typeof description === 'string' ? (
          <Description title={description} showOnlyOnOverflow>
            {description}
          </Description>
        ) : (
          <InspectorWrapper>
            <ObjectInspector
              data={description}
              expandPaths={expandPaths}
              onExpand={handleDimensionChange}
              theme={{
                TREENODE_FONT_SIZE: '0.7rem',
                ARROW_FONT_SIZE: '0.5rem',
              }}
            />
          </InspectorWrapper>
        )}
      </CrumbDetails>
    </CrumbItem>
  );
}

const InspectorWrapper = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
`;

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
  isCurrent: boolean;
  isHovered: boolean;
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
  ${p => p.isCurrent && `background-color: ${p.theme.purple100};`}
  ${p => p.isHovered && `background-color: ${p.theme.surface200};`}
  border-radius: ${p => p.theme.borderRadius};

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

export default memo(BreadcrumbItem);
