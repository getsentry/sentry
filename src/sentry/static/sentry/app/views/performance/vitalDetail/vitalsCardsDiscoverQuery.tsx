import React from 'react';

import {MetaType} from 'app/utils/discover/eventView';
import {WebVital} from 'app/utils/discover/fields';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
} from 'app/utils/discover/genericDiscoverQuery';
import withApi from 'app/utils/withApi';

import {
  vitalsBaseFields,
  vitalsMehFields,
  vitalsP75Fields,
  vitalsPoorFields,
} from './utils';

export type TableDataRow = {
  id: string;
  [key: string]: React.ReactText;
};
export type TableData = {
  data: Array<TableDataRow>;
  meta?: MetaType;
};

type Props = DiscoverQueryProps & {
  vitals: WebVital[];
};

function getRequestPayload(props: Props) {
  const {eventView, vitals} = props;
  const apiPayload = eventView?.getEventsAPIPayload(props.location);
  const vitalFields: string[] = vitals
    .map(vital =>
      [
        vitalsPoorFields[vital],
        vitalsBaseFields[vital],
        vitalsMehFields[vital],
        vitalsP75Fields[vital],
      ].filter(Boolean)
    )
    .reduce((fields, fs) => fields.concat(fs), []);
  apiPayload.field = [...vitalFields];
  delete apiPayload.sort;
  return apiPayload;
}

function VitalsCardDiscoverQuery(props: Props) {
  return (
    <GenericDiscoverQuery<TableData, Props>
      getRequestPayload={getRequestPayload}
      route="eventsv2"
      noPagination
      {...props}
    />
  );
}

export default withApi(VitalsCardDiscoverQuery);
