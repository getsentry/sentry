import React from 'react';

import withApi from 'app/utils/withApi';
import {MetaType} from 'app/utils/discover/eventView';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
} from 'app/utils/discover/genericDiscoverQuery';

import {vitalsBaseFields, vitalsThresholdFields} from './utils';

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
    ? [vitalsThresholdFields[onlyVital], vitalsBaseFields[onlyVital]]
    : [...Object.values(vitalsThresholdFields), ...Object.values(vitalsBaseFields)];
  apiPayload.field = ['count()', ...vitalFields];
  apiPayload.query = 'event.type:transaction';
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
