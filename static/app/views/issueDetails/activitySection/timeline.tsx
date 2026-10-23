import {Container, Flex} from '@sentry/scraps/layout';

import {defined} from 'sentry/utils/defined';

import {
  ActivityLineContent,
  ActivityLineList,
  ActivityLineRow,
} from './activityLineItem/layout';

interface TimelineItemProps {
  headline: React.ReactNode;
  marker: React.ReactNode;
  children?: React.ReactNode;
}

function Item({marker, headline, children}: TimelineItemProps) {
  return (
    <ActivityLineRow>
      <Container column={1} row={1}>
        {marker}
      </Container>
      <Flex column={2} row={1} minWidth={0} minHeight="22px" align="center">
        {headline}
      </Flex>
      {defined(children) && <ActivityLineContent>{children}</ActivityLineContent>}
    </ActivityLineRow>
  );
}

export const Timeline = {Container: ActivityLineList, Item};
