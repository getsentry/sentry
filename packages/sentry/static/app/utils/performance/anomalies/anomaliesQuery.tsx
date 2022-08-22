import {EventsStatsData, Organization} from 'sentry/types';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import withApi from 'sentry/utils/withApi';
import {ANOMALY_FLAG} from 'sentry/views/performance/transactionSummary/transactionAnomalies/utils';

type AnomaliesProps = {};
type RequestProps = DiscoverQueryProps & AnomaliesProps;

export type ChildrenProps = Omit<GenericChildrenProps<AnomaliesProps>, 'tableData'> & {
  data: AnomalyPayload | null;
};

type Props = Omit<RequestProps, 'orgSlug'> & {
  children: (props: ChildrenProps) => React.ReactNode;
  organization: Organization;
};

export type AnomalyConfidence = 'high' | 'low';

// Should match events stats data in format.
type AnomalyStatsData = {
  data: EventsStatsData;
  end?: number;
  start?: number;
};

// Anomaly info describes what the anomaly service determines is an 'anomaly area'.
export type AnomalyInfo = {
  confidence: AnomalyConfidence;
  end: number;
  expected: number;
  id: string;
  received: number;
  start: number;
};

export type AnomalyPayload = {
  anomalies: AnomalyInfo[];
  y: AnomalyStatsData;
  yhat_lower: AnomalyStatsData;
  yhat_upper: AnomalyStatsData;
};

function transformStatsTimes(stats: AnomalyStatsData) {
  stats.data.forEach(d => (d[0] = d[0] * 1000));
  return stats;
}
function transformAnomaliesTimes(anoms: AnomalyInfo[]) {
  anoms.forEach(a => {
    a.start = a.start * 1000;
    a.end = a.end * 1000;
  });
  return anoms;
}

function transformPayload(payload: AnomalyPayload): AnomalyPayload {
  const newPayload = {...payload};
  if (!payload.y || !payload.yhat_lower || !payload.yhat_upper || !payload.anomalies) {
    return newPayload;
  }

  newPayload.y = transformStatsTimes(payload.y);
  newPayload.yhat_upper = transformStatsTimes(payload.yhat_upper);
  newPayload.yhat_lower = transformStatsTimes(payload.yhat_lower);
  newPayload.anomalies = transformAnomaliesTimes(payload.anomalies);
  return newPayload;
}

function AnomaliesSeriesQuery(props: Props) {
  if (!props.organization.features.includes(ANOMALY_FLAG)) {
    return (
      <div>
        {props.children({data: null, isLoading: false, error: null, pageLinks: null})}
      </div>
    );
  }

  return (
    <GenericDiscoverQuery<AnomalyPayload, {}>
      route="transaction-anomaly-detection"
      {...props}
    >
      {({tableData, ...rest}) => {
        return props.children({
          data: tableData && tableData.y ? transformPayload(tableData) : null,
          ...rest,
        });
      }}
    </GenericDiscoverQuery>
  );
}

export default withApi(AnomaliesSeriesQuery);
