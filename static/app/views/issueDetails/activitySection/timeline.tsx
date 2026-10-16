import {Container} from '@sentry/scraps/layout';

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
      <Container column={2} row={1} minWidth={0}>
        {headline}
      </Container>
      {defined(children) ? <ActivityLineContent>{children}</ActivityLineContent> : null}
    </ActivityLineRow>
  );
}

/** Layout only: callers compose markers, headlines, and bodies. */
export const Timeline = {Container: ActivityLineList, Item};
