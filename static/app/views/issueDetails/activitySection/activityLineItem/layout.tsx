import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex, Container, type ContainerProps} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {tct} from 'sentry/locale';

export type ActivityLineVariant = 'compact' | 'full';

interface ActivityLineHeadlineProps {
  timestamp: React.ReactNode;
  title: React.ReactNode;
  details?: React.ReactNode;
  source?: string;
}

export function ActivityLineHeadline({
  title,
  details,
  source,
  timestamp,
}: ActivityLineHeadlineProps) {
  return (
    <Flex column={2} row={1} minWidth={0} minHeight="22px" align="baseline">
      <ActivityLineSentence>
        <ActivityLineTitleText
          as="span"
          bold
          density="comfortable"
          wordBreak="break-word"
        >
          {title}
        </ActivityLineTitleText>
        {details ? (
          <Fragment>
            {' '}
            <ActivityLineDetails>{details}</ActivityLineDetails>
          </Fragment>
        ) : null}
        {source ? (
          <Fragment>
            {' '}
            <ActivityLineDetails>{tct('via [source]', {source})}</ActivityLineDetails>
          </Fragment>
        ) : null}
        <Fragment>
          {' '}
          <Flex as="span" display="inline-flex" align="center" flexShrink={0} gap="xs">
            <Text as="span" variant="muted" density="comfortable">
              &bull;
            </Text>
            <Text as="span" variant="muted" density="comfortable" wrap="nowrap">
              {timestamp}
            </Text>
          </Flex>
        </Fragment>
      </ActivityLineSentence>
    </Flex>
  );
}

export const ActivityLineRow = styled('div')`
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: auto auto;
  align-items: start;
  column-gap: ${p => p.theme.space.xs};

  @container activity-list (min-width: 90px) {
    column-gap: ${p => p.theme.space.sm};
  }

  &:not(:last-child)::before {
    content: '';
    position: absolute;
    left: 10.5px;
    top: 11px;
    bottom: calc(-${p => p.theme.space.md} - 11px);
    border-left: 1px solid
      ${p => p.theme.tokens.border.transparent.neutral.muted};
  }
`;

const ActivityLineSentence = styled('span')`
  min-width: 0;
  overflow-wrap: anywhere;
`;

const ActivityLineTitleText = styled(Text)`
  min-width: 0;
  overflow-wrap: anywhere;
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

export function ActivityLineContent(props: ContainerProps) {
  return <Container minWidth="0" row="2" column="2" {...props} />;
}

export const ActivityLineList = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  container-name: activity-list;
  container-type: inline-size;
`;
