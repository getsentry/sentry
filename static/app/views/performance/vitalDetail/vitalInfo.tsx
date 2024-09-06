import type {Location} from 'history';

import type {Organization} from 'sentry/types/organization';
import toArray from 'sentry/utils/array/toArray';
import type EventView from 'sentry/utils/discover/eventView';
import type {WebVital} from 'sentry/utils/fields';
import VitalsCardDiscoverQuery from 'sentry/utils/performance/vitals/vitalsCardsDiscoverQuery';

import {VitalBar} from '../landing/vitalsCards';

type ViewProps = Pick<
  EventView,
  'environment' | 'project' | 'start' | 'end' | 'statsPeriod'
>;

type Props = ViewProps & {
  location: Location;
  orgSlug: Organization['slug'];
  vital: WebVital | WebVital[];
  hideBar?: boolean;
  hideDurationDetail?: boolean;
  hideStates?: boolean;
  hideVitalPercentNames?: boolean;
  hideVitalThresholds?: boolean;
  isLoading?: boolean;
  p75AllTransactions?: number;
  queryExtras?: Record<string, string>;
};

function VitalInfo({
  vital,
  location,
  isLoading,
  hideBar,
  hideStates,
  hideVitalPercentNames,
  hideVitalThresholds,
  hideDurationDetail,
  queryExtras,
}: Props) {
  const vitals = toArray(vital);
  const contentCommonProps = {
    vital,
    showBar: !hideBar,
    showStates: !hideStates,
    showVitalPercentNames: !hideVitalPercentNames,
    showVitalThresholds: !hideVitalThresholds,
    showDurationDetail: !hideDurationDetail,
  };

  return (
    <VitalsCardDiscoverQuery
      location={location}
      vitals={vitals}
      queryExtras={queryExtras}
    >
      {({isLoading: loading, vitalsData}) => (
        <VitalBar
          {...contentCommonProps}
          isLoading={isLoading || loading}
          data={vitalsData}
        />
      )}
    </VitalsCardDiscoverQuery>
  );
}

export default VitalInfo;
