import TimeSince from 'sentry/components/timeSince';
import {EmptyCell} from 'sentry/components/workflowEngine/gridCell/emptyCell';

type TimeAgoCellProps = {
  date?: Date;
};

export function TimeAgoCell({date}: TimeAgoCellProps) {
  return <div>{date ? <TimeSince date={date} /> : <EmptyCell />}</div>;
}
