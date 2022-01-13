import * as React from 'react';
import pick from 'lodash/pick';

import {MetaType} from 'sentry/utils/discover/eventView';
import {WebVital} from 'sentry/utils/discover/fields';
import GenericDiscoverQuery, {
  DiscoverQueryPropsWithContext,
  GenericChildrenProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {PERFORMANCE_URL_PARAM} from 'sentry/utils/performance/constants';
import withApi from 'sentry/utils/withApi';

export interface TableDataRow {
  id: string;
  [key: string]: React.ReactText;
}

export interface TableData {
  data: Array<TableDataRow>;
  meta?: MetaType;
}

export interface VitalData {
  poor: number;
  meh: number;
  good: number;
  total: number;
  p75: number | null;
}

export type VitalsData = Record<string, VitalData>;

interface VitalsProps {
  vitals: WebVital[];
}

interface RequestProps extends DiscoverQueryPropsWithContext, VitalsProps {}

type ChildrenProps = Omit<GenericChildrenProps<VitalsProps>, 'tableData'> & {
  vitalsData: VitalsData | null;
};

interface Props extends RequestProps {
  children: (props: ChildrenProps) => React.ReactNode;
}

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

export default withApi(VitalsCardsDiscoverQuery);
