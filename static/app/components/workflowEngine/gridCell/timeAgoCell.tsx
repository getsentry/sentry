import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';

type TimeAgoCellProps = {
  date?: Date;
};

export function TimeAgoCell({date}: TimeAgoCellProps) {
  return <div>{date ? <TimeSince date={date} /> : t('Never')}</div>;
}
