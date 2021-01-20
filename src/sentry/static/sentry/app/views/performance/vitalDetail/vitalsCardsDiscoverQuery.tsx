import React from 'react';
import pick from 'lodash/pick';

import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {MetaType} from 'app/utils/discover/eventView';
import {WebVital} from 'app/utils/discover/fields';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'app/utils/discover/genericDiscoverQuery';
import withApi from 'app/utils/withApi';

export type TableDataRow = {
  id: string;
  [key: string]: React.ReactText;
};

export type TableData = {
  data: Array<TableDataRow>;
  meta?: MetaType;
};

export type VitalData = {
  poor: number;
  meh: number;
  good: number;
  total: number;
  p75: number | null;
};

export type VitalsData = Record<string, VitalData>;

type VitalsProps = {
  vitals: WebVital[];
};

type RequestProps = DiscoverQueryProps & VitalsProps;

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
    ...pick(apiPayload, ['query', ...Object.values(URL_PARAM)]),
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
