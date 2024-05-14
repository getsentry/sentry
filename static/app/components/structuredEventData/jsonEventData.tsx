import StructuredEventData, {
  type StructedEventDataConfig,
  type StructuredEventDataProps,
} from 'sentry/components/structuredEventData';

type JsonEventDataProps = Omit<StructuredEventDataProps, 'config'>;

const config: StructedEventDataConfig = {
  isString: value => typeof value === 'string',
  renderObjectKeys: value => `"${value}"`,
};

export function JsonEventData(props: JsonEventDataProps) {
  return <StructuredEventData {...props} config={config} />;
}
