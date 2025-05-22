import {AutofixTimelineItem} from 'sentry/components/events/autofix/autofixTimelineItem';
import {Timeline} from 'sentry/components/timeline';

import type {AutofixTimelineEvent} from './types';

type Props = {
  events: AutofixTimelineEvent[];
  groupId: string;
  runId: string;
  eventCodeUrls?: Array<string | null>;
  getCustomIcon?: (event: AutofixTimelineEvent) => React.ReactNode;
  retainInsightCardIndex?: number | null;
  stepIndex?: number;
};

export function AutofixTimeline({
  events,
  getCustomIcon,
  groupId,
  runId,
  stepIndex = 0,
  retainInsightCardIndex = null,
  eventCodeUrls,
}: Props) {
  if (!events?.length) {
    return null;
  }

  return (
    <Timeline.Container>
      {events.map((event, index) => {
        const isMostImportantEvent =
          !!event.is_most_important_event && index !== events.length - 1;

        return (
          <AutofixTimelineItem
            key={index}
            index={index}
            event={event}
            isMostImportantEvent={isMostImportantEvent}
            getCustomIcon={getCustomIcon}
            groupId={groupId}
            runId={runId}
            stepIndex={stepIndex}
            retainInsightCardIndex={retainInsightCardIndex}
            codeUrl={eventCodeUrls ? eventCodeUrls[index] : null}
          />
        );
      })}
    </Timeline.Container>
  );
}
