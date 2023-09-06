import {CSSProperties} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';
import beautify from 'js-beautify';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {space} from 'sentry/styles/space';
import type {Extraction} from 'sentry/utils/replays/extractDomNodes';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import type useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import IconWrapper from 'sentry/views/replays/detail/iconWrapper';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

interface Props extends ReturnType<typeof useCrumbHandlers> {
  currentHoverTime: number | undefined;
  currentTime: number;
  mutation: Extraction;
  startTimestampMs: number;
  style: CSSProperties;
}

function DomMutationRow({
  currentHoverTime,
  currentTime,
  onMouseEnter,
  onMouseLeave,
  mutation,
  onClickTimestamp,
  startTimestampMs,
  style,
}: Props) {
  const {html, frame} = mutation;

  const hasOccurred = currentTime >= frame.offsetMs;
  const isBeforeHover =
    currentHoverTime === undefined || currentHoverTime >= frame.offsetMs;

  const {color, title, icon} = getFrameDetails(frame);

  return (
    <MutationListItem
      className={classNames({
        beforeCurrentTime: hasOccurred,
        afterCurrentTime: !hasOccurred,
        beforeHoverTime: currentHoverTime !== undefined && isBeforeHover,
        afterHoverTime: currentHoverTime !== undefined && !isBeforeHover,
      })}
      onMouseEnter={() => onMouseEnter(frame)}
      onMouseLeave={() => onMouseLeave(frame)}
      style={style}
    >
      <IconWrapper color={color} hasOccurred={hasOccurred}>
        {icon}
      </IconWrapper>
      <List>
        <Row>
          <Title hasOccurred={hasOccurred}>{title}</Title>
          <TimestampButton
            onClick={event => {
              event.stopPropagation();
              onClickTimestamp(frame);
            }}
            startTimestampMs={startTimestampMs}
            timestampMs={frame.timestampMs}
          />
        </Row>
        {/* @ts-expect-error */}
        <Selector>{frame.message ?? ''}</Selector>
        {html ? (
          <CodeContainer>
            <CodeSnippet language="html" hideCopyButton>
              {beautify.html(html, {indent_size: 2})}
            </CodeSnippet>
          </CodeContainer>
        ) : null}
      </List>
    </MutationListItem>
  );
}

const MutationListItem = styled('div')`
  display: flex;
  gap: ${space(1)};
  padding: ${space(1)} ${space(1.5)};

  /* Overridden in TabItemContainer, depending on *CurrentTime and *HoverTime classes */
  border-top: 1px solid transparent;
  border-bottom: 1px solid transparent;
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
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Title = styled('span')<{hasOccurred?: boolean}>`
  color: ${p => (p.hasOccurred ? p.theme.gray400 : p.theme.gray300)};
  font-size: ${p => p.theme.fontSizeMedium};
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
