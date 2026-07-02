import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

export type ActivityLineVariant = 'compact' | 'full';

interface ActivityLineRowProps {
  children: React.ReactNode;
  variant: ActivityLineVariant;
}

interface ActivityLineHeadlineProps {
  timestamp: React.ReactNode;
  title: React.ReactNode;
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
}: ActivityLineHeadlineProps) {
  return (
    <Flex
      column={3}
      row={1}
      minWidth={0}
      minHeight={22}
      align="center"
      wrap="wrap"
      gap="xs"
    >
      <ActivityLineTitle>{title}</ActivityLineTitle>
      {details && <ActivityLineDetails>{details}</ActivityLineDetails>}
      <ActivityLineMeta>
        <ActivityLineMutedText>&bull;</ActivityLineMutedText>
        <ActivityLineTimestamp>{timestamp}</ActivityLineTimestamp>
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

const ActivityLineDetails = styled('span')`
  display: contents;
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
  line-height: 1.4;
  overflow-wrap: anywhere;
  word-break: break-word;
`;

const ActivityLineTitle = styled('span')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.font.size.md};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  line-height: 1.6;
  overflow-wrap: anywhere;
  word-break: break-word;
`;

const ActivityLineMutedText = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
  line-height: 1.4;
`;

const ActivityLineTimestamp = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
  line-height: 1.4;
  white-space: nowrap;
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
