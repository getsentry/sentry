import React from 'react';

import withApi from 'app/utils/withApi';
import {MetaType} from 'app/utils/discover/eventView';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
} from 'app/utils/discover/genericDiscoverQuery';

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
  let vitalFields = [
    'count_at_least(measurements.lcp, 4000)',
    'count_at_least(measurements.fcp, 3000)',
    'count_at_least(measurements.fp, 3000)',
    'count_at_least(measurements.fid, 300)',
    'count_at_least(measurements.cls, 0.25)',
    'percentage(count_at_least_measurements_lcp_4000, count, lcp_percentage)',
    'percentage(count_at_least_measurements_fcp_3000, count, fcp_percentage)',
    'percentage(count_at_least_measurements_fp_3000, count, fp_percentage)',
    'percentage(count_at_least_measurements_fid_300, count, fid_percentage)',
    'percentage(count_at_least_measurements_cls_0_25, count, cls_percentage)',
  ];
  if (onlyVital) {
    vitalFields = vitalFields.filter(field =>
      field.includes(onlyVital.replace('measurements.', ''))
    );
  }
  apiPayload.field = ['count()', ...vitalFields];
  apiPayload.query = 'event.type:transaction has:measurements.lcp'; // This is only somewhat accurate, just for the time being
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
