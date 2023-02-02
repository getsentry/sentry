import {Location} from 'history';

import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {WebVital} from 'sentry/utils/fields';
import {useMEPSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import VitalsCardDiscoverQuery from 'sentry/utils/performance/vitals/vitalsCardsDiscoverQuery';
import toArray from 'sentry/utils/toArray';
import useOrganization from 'sentry/utils/useOrganization';
import {getTransactionMEPParamsIfApplicable} from 'sentry/views/performance/transactionSummary/transactionOverview/utils';

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

  const mepSetting = useMEPSettingContext();
  const organization = useOrganization();
  const queryExtras = getTransactionMEPParamsIfApplicable(
    mepSetting,
    organization,
    location
  );

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
