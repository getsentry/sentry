import TimeSince from 'sentry/components/timeSince';

type TimeAgoCellProps = {
  date?: Date;
};

export function TimeAgoCell({date}: TimeAgoCellProps) {
  return <div>{date ? <TimeSince date={date} /> : <span>&mdash;</span>}</div>;
}
