import pick from 'lodash/pick';

import type {MetaType} from 'sentry/utils/discover/eventView';
import type {
  DiscoverQueryPropsWithContext,
  GenericChildrenProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import GenericDiscoverQuery from 'sentry/utils/discover/genericDiscoverQuery';
import type {WebVital} from 'sentry/utils/fields';
import {PERFORMANCE_URL_PARAM} from 'sentry/utils/performance/constants';

export type TableDataRow = {
  [key: string]: React.ReactText;
  id: string;
};

export type TableData = {
  data: TableDataRow[];
  meta?: MetaType;
};

export type VitalData = {
  good: number;
  meh: number;
  p75: number | null;
  poor: number;
  total: number;
};

export type VitalsData = Record<string, VitalData>;

type VitalsProps = {
  vitals: WebVital[];
};

type RequestProps = DiscoverQueryPropsWithContext & VitalsProps;

type ChildrenProps = Omit<GenericChildrenProps<VitalsProps>, 'tableData'> & {
  vitalsData: VitalsData | null;
};

type Props = RequestProps & {
  children: (props: ChildrenProps) => React.ReactNode;
};

function getRequestPayload(props: RequestProps) {
  const {eventView, vitals} = props;
  const apiPayload = eventView?.getEventsAPIPayload(props.location);
  return {
    vital: vitals,
    ...pick(apiPayload, ['query', ...Object.values(PERFORMANCE_URL_PARAM)]),
  };
}

function VitalsCardsDiscoverQuery(props: Props) {
  return (
    <GenericDiscoverQuery<VitalsData, VitalsProps>
      getRequestPayload={getRequestPayload}
      route="events-vitals"
      {...props}
    >
      {({tableData, ...rest}) => {
        return props.children({vitalsData: tableData, ...rest});
      }}
    </GenericDiscoverQuery>
  );
}

export default VitalsCardsDiscoverQuery;
