import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

export type ActivityLineVariant = 'compact' | 'full';

interface ActivityLineRowProps {
  children: React.ReactNode;
  variant: ActivityLineVariant;
}

interface ActivityLineHeadlineProps {
  timestamp: React.ReactNode;
  title: React.ReactNode;
  variant: ActivityLineVariant;
  actions?: React.ReactNode;
  details?: React.ReactNode;
}

export function ActivityLineRow({children, variant}: ActivityLineRowProps) {
  if (variant === 'compact') {
    return <CompactActivityLineRow>{children}</CompactActivityLineRow>;
  }

  return <ActivityLineRowElement>{children}</ActivityLineRowElement>;
}

export function ActivityLineHeadline({
  title,
  details,
  timestamp,
  actions,
  variant,
}: ActivityLineHeadlineProps) {
  return (
    <Flex
      column={3}
      row={1}
      minWidth={0}
      minHeight="22px"
      align="center"
      wrap="wrap"
      gap="xs"
    >
      <ActivityLineTitleText
        as="span"
        bold
        data-compact={variant === 'compact' ? true : undefined}
        density="comfortable"
        wordBreak="break-word"
      >
        {title}
      </ActivityLineTitleText>
      {details && <ActivityLineDetails>{details}</ActivityLineDetails>}
      <ActivityLineMeta>
        <Text as="span" variant="muted" density="comfortable">
          &bull;
        </Text>
        <Text as="span" variant="muted" density="comfortable" wrap="nowrap">
          {timestamp}
        </Text>
        {actions}
      </ActivityLineMeta>
    </Flex>
  );
}

export function ActivityLineContent({children}: {children: React.ReactNode}) {
  return <ActivityLineContentElement>{children}</ActivityLineContentElement>;
}

const activityLineRowStyles = (p: {theme: Theme}) => css`
  position: relative;
  display: grid;
  grid-template-columns: 22px 22px minmax(0, 1fr);
  grid-template-rows: auto auto;
  align-items: start;

  &:last-child {
    &::after {
      content: '';
      position: absolute;
      z-index: 1;
      left: 10.5px;
      top: 22px;
      bottom: 0;
      width: 1px;
      background: ${p.theme.tokens.background.overlay};
    }
  }
`;

const ActivityLineRowElement = styled('div')`
  ${activityLineRowStyles};
  column-gap: ${p => p.theme.space.md};
`;

const CompactActivityLineRow = styled('div')`
  ${activityLineRowStyles};
  column-gap: ${p => p.theme.space.sm};
`;

const ActivityLineTitleText = styled(Text)`
  min-width: 0;
  overflow-wrap: anywhere;

  &[data-compact='true'] {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
`;

const ActivityLineDetails = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
  line-height: 1.4;
  overflow-wrap: anywhere;
  word-break: break-word;
  /* Trim the line box so the text lines up with the title and timestamp. */
  text-box-edge: text text;
  text-box-trim: trim-both;
`;

const ActivityLineMeta = styled('span')`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  flex-shrink: 0;
`;

const ActivityLineContentElement = styled('div')`
  grid-column: 3;
  grid-row: 2;
  min-width: 0;
  margin-top: ${p => p.theme.space.sm};
`;
