import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {Event} from 'sentry/types/event';

type Props = {
  alias: string;
  data: Record<string, React.ReactNode | undefined>;
  event: Event;
};

function getKnownData(data: Props['data']) {
  return Object.entries(data)
    .filter(([k]) => k !== 'type' && k !== 'title')
    .map(([key, value]) => ({
      key,
      subject: key,
      value,
    }));
}

export const MonitorContext = ({data}: Props) => {
  console.log(data);

  return <ContextBlock data={getKnownData(data)} />;
};
