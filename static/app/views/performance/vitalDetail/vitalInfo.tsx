import {Location} from 'history';

import {WebVital} from 'sentry/utils/discover/fields';
import VitalsCardDiscoverQuery from 'sentry/utils/performance/vitals/vitalsCardsDiscoverQuery';

import {VitalBar} from '../landing/vitalsCards';

type Props = {
  location: Location;
  vital: WebVital | WebVital[];
  hideBar?: boolean;
  hideStates?: boolean;
  hideVitalPercentNames?: boolean;
  hideDurationDetail?: boolean;
};

export default function vitalInfo(props: Props) {
  const {
    vital,
    location,
    hideBar,
    hideStates,
    hideVitalPercentNames,
    hideDurationDetail,
  } = props;

  return (
    <VitalsCardDiscoverQuery
      location={location}
      vitals={Array.isArray(vital) ? vital : [vital]}
    >
      {({isLoading, vitalsData}) => (
        <VitalBar
          isLoading={isLoading}
          data={vitalsData}
          vital={vital}
          showBar={!hideBar}
          showStates={!hideStates}
          showVitalPercentNames={!hideVitalPercentNames}
          showDurationDetail={!hideDurationDetail}
        />
      )}
    </VitalsCardDiscoverQuery>
  );
}
