import React from 'react';

import {MetaType} from 'app/utils/discover/eventView';
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
  onlyVital?: string;
};

function getRequestPayload(props: Props) {
  const {eventView, onlyVital} = props;
  const apiPayload = eventView?.getEventsAPIPayload(props.location);
  const vitalFields = onlyVital
    ? [
        vitalsPoorFields[onlyVital],
        vitalsBaseFields[onlyVital],
        vitalsMehFields[onlyVital],
        vitalsP75Fields[onlyVital],
      ]
    : [
        ...Object.values(vitalsPoorFields),
        ...Object.values(vitalsMehFields),
        ...Object.values(vitalsBaseFields),
        ...Object.values(vitalsP75Fields),
      ];
  apiPayload.field = [...vitalFields];
  delete apiPayload.sort;
  return apiPayload;
}

function VitalsCardDiscoverQuery(props: Props) {
  return (
    <GenericDiscoverQuery<TableData, {}>
      getRequestPayload={getRequestPayload}
      route="eventsv2"
      {...props}
    />
  );
}

export default withApi(VitalsCardDiscoverQuery);
