import EventView from 'sentry/utils/discover/eventView';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'sentry/utils/discover/genericDiscoverQuery';

export interface MetricsCompatibilityData {
  compatible_projects?: number[];
}

type QueryProps = Omit<DiscoverQueryProps, 'eventView' | 'api'> & {
  children: (props: GenericChildrenProps<MetricsCompatibilityData>) => React.ReactNode;
  eventView: EventView;
};

function getRequestPayload({
  eventView,
  location,
}: Pick<DiscoverQueryProps, 'eventView' | 'location'>) {
  const {
    field: _f,
    sort: _s,
    per_page: _p,
    query: _c,
    ...additionalApiPayload
  } = eventView.getEventsAPIPayload(location);
  return additionalApiPayload;
}

export default function MetricsCompatibilityQuery({children, ...props}: QueryProps) {
  return (
    <GenericDiscoverQuery<MetricsCompatibilityData, {}>
      route="metrics-compatibility-sums"
      getRequestPayload={getRequestPayload}
      {...props}
    >
      {({tableData, ...rest}) => {
        return children({
          tableData,
          ...rest,
        });
      }}
    </GenericDiscoverQuery>
  );
}
