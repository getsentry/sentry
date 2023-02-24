import {CSSProperties, useCallback} from 'react';
import styled from '@emotion/styled';
import beautify from 'js-beautify';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import BreadcrumbIcon from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type/icon';
import {getDetails} from 'sentry/components/replays/breadcrumbs/utils';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {SVGIconProps} from 'sentry/icons/svgIcon';
import {space} from 'sentry/styles/space';
import {getPrevReplayEvent} from 'sentry/utils/replays/getReplayEvent';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import type {Extraction} from 'sentry/utils/replays/hooks/useExtractedCrumbHtml';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

type Props = {
  mutation: Extraction;
  mutations: Extraction[];
  startTimestampMs: number;
  style: CSSProperties;
};

function DomMutationRow({mutation, mutations, startTimestampMs, style}: Props) {
  const {html, crumb: breadcrumb} = mutation;

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

  const breadcrumbs = mutations.map(({crumb}) => crumb);
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

  const hasOccurred =
    currentTime >= relativeTimeInMs(breadcrumb.timestamp || 0, startTimestampMs);
  const isCurrent = breadcrumb.id === current?.id;
  const isHovered = breadcrumb.id === hovered?.id;

  const {title} = getDetails(breadcrumb);

  return (
    <MutationListItem
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={style}
      isCurrent={isCurrent}
      isHovered={isHovered}
    >
      <IconWrapper color={breadcrumb.color} hasOccurred={hasOccurred}>
        <BreadcrumbIcon type={breadcrumb.type} />
      </IconWrapper>
      <List>
        <Row>
          <Title hasOccurred={hasOccurred}>{title}</Title>
          <TimestampButton
            onClick={onClickTimestamp}
            startTimestampMs={startTimestampMs}
            timestampMs={breadcrumb.timestamp || ''}
          />
        </Row>
        <Selector>{breadcrumb.message}</Selector>
        <CodeContainer>
          <CodeSnippet language="html" hideCopyButton>
            {beautify.html(html, {indent_size: 2})}
          </CodeSnippet>
        </CodeContainer>
      </List>
    </MutationListItem>
  );
}

const MutationListItem = styled('div')<{
  isCurrent: boolean;
  isHovered: boolean;
}>`
  display: flex;
  gap: ${space(1)};
  padding: ${space(1)} ${space(1.5)};

  border-bottom: 1px solid
    ${p =>
      p.isCurrent ? p.theme.purple300 : p.isHovered ? p.theme.purple200 : 'transparent'};

  &:hover {
    background-color: ${p => p.theme.hover};
  }

  /*
  Draw a vertical line behind the breadcrumb icon.
  The line connects each row together, but is truncated for the first and last items.
  */
  position: relative;
  &::after {
    content: '';
    position: absolute;
    top: 0;
    /* $padding + $half_icon_width - $space_for_the_line */
    left: calc(${space(1.5)} + (24px / 2) - 1px);
    width: 1px;
    height: 100%;
    background: ${p => p.theme.gray200};
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

const List = styled('div')`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 100%;
`;

const Row = styled('div')`
  display: flex;
  flex-direction: row;
`;

/**
 * Taken `from events/interfaces/.../breadcrumbs/types`
 */
const IconWrapper = styled('div')<
  {hasOccurred: boolean} & Required<Pick<SVGIconProps, 'color'>>
>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  min-width: 24px;
  height: 24px;
  border-radius: 50%;
  color: ${p => p.theme.white};
  background: ${p => (p.hasOccurred ? p.theme[p.color] ?? p.color : p.theme.purple200)};

  /* Make sure the icon is above the line through the back */
  z-index: ${p => p.theme.zIndex.initial};
`;

const Title = styled('span')<{hasOccurred?: boolean}>`
  color: ${p => (p.hasOccurred ? p.theme.gray400 : p.theme.gray300)};
  font-weight: bold;
  line-height: ${p => p.theme.text.lineHeightBody};
  text-transform: capitalize;
  ${p => p.theme.overflowEllipsis};
`;

const Selector = styled('p')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
  margin-bottom: 0;
`;

const CodeContainer = styled('div')`
  margin-top: ${space(1)};
  max-height: 400px;
  max-width: 100%;
  overflow: auto;
`;

export default DomMutationRow;
