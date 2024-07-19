import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import type {Event} from 'sentry/types/event';

type Props = {
  alias: string;
  data: Record<string, React.ReactNode | undefined>;
  event: Event;
};

export function getDefaultContextData(data: Props['data']) {
  return Object.entries(data)
    .filter(([k]) => k !== 'type' && k !== 'title')
    .map(([key, value]) => ({
      key,
      subject: key,
      value,
    }));
}

export function DefaultContext({data}: Props) {
  return <ContextBlock data={getDefaultContextData(data)} />;
}
