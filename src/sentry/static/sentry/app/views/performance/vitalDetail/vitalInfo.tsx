import React from 'react';
import {Location} from 'history';

import {Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {WebVital} from 'app/utils/discover/fields';
import VitalsCardDiscoverQuery from 'app/views/performance/vitalDetail/vitalsCardsDiscoverQuery';

import {VitalBar} from '../landing/vitalsCards';

type Props = {
  eventView: EventView;
  organization: Organization;
  location: Location;
  vital: WebVital | WebVital[];
  hideBar?: boolean;
  hideEmptyState?: boolean;
  hideVitalPercentNames?: boolean;
  hideDurationDetail?: boolean;
};

export default function vitalInfo(props: Props) {
  const {
    vital,
    eventView,
    organization,
    location,
    hideBar,
    hideEmptyState,
    hideVitalPercentNames,
    hideDurationDetail,
  } = props;
  return (
    <VitalsCardDiscoverQuery
      eventView={eventView}
      orgSlug={organization.slug}
      location={location}
      vitals={Array.isArray(vital) ? vital : [vital]}
    >
      {({isLoading, tableData}) => (
        <React.Fragment>
          <VitalBar
            isLoading={isLoading}
            showBar={!hideBar}
            showEmptyState={!hideEmptyState}
            showVitalPercentNames={!hideVitalPercentNames}
            showDurationDetail={!hideDurationDetail}
            result={tableData?.data?.[0]}
            vital={vital}
          />
        </React.Fragment>
      )}
    </VitalsCardDiscoverQuery>
  );
}
