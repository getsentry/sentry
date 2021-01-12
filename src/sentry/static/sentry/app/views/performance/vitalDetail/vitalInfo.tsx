import React from 'react';
import {Location} from 'history';

import {Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {WebVital} from 'app/utils/discover/fields';
import VitalsCardDiscoverQuery from 'app/views/performance/vitalDetail/vitalsCardsDiscoverQuery';

import {VitalsCard} from '../vitalsCards';

type Props = {
  eventView: EventView;
  organization: Organization;
  location: Location;
  vitalName: WebVital;
  hideBar?: boolean;
  hideEmptyState?: boolean;
  hideVitalPercentNames?: boolean;
  hideDurationDetail?: boolean;
};

export default function vitalInfo(props: Props) {
  const {
    vitalName,
    eventView,
    organization,
    location,
    hideVitalPercentNames,
    hideDurationDetail,
  } = props;
  return (
    <VitalsCardDiscoverQuery
      eventView={eventView}
      orgSlug={organization.slug}
      location={location}
      onlyVital={vitalName}
    >
      {({isLoading, tableData}) => (
        <React.Fragment>
          <VitalsCard
            tableData={tableData}
            isLoading={isLoading}
            {...props}
            noBorder
            showVitalPercentNames={!hideVitalPercentNames}
            showDurationDetail={!hideDurationDetail}
          />
        </React.Fragment>
      )}
    </VitalsCardDiscoverQuery>
  );
}
