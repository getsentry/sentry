import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

export type ActivityLineVariant = 'compact' | 'full';

interface ActivityLineHeadlineProps {
  timestamp: React.ReactNode;
  title: React.ReactNode;
  details?: React.ReactNode;
}

export function ActivityLineHeadline({
  title,
  details,
  timestamp,
}: ActivityLineHeadlineProps) {
  return (
    <Flex column={3} row={1} minWidth={0} minHeight="22px" align="baseline">
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
        <Fragment>
          {' '}
          <ActivityLineMeta>
            <Text as="span" variant="muted" density="comfortable">
              &bull;
            </Text>
            <Text as="span" variant="muted" density="comfortable" wrap="nowrap">
              {timestamp}
            </Text>
          </ActivityLineMeta>
        </Fragment>
      </ActivityLineSentence>
    </Flex>
  );
}

export const ActivityLineRow = styled('div')`
  position: relative;
  display: grid;
  grid-template-columns: 22px 22px minmax(0, 1fr);
  grid-template-rows: auto auto;
  align-items: start;
  column-gap: ${p => p.theme.space.xs};

  @container activity-list (min-width: 90px) {
    column-gap: ${p => p.theme.space.sm};
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

const ActivityLineMeta = styled('span')`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  flex-shrink: 0;
`;

export const ActivityLineContent = styled('div')`
  grid-column: 3;
  grid-row: 2;
  min-width: 0;
`;
