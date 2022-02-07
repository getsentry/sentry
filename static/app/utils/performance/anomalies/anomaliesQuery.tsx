import {EventsStatsData} from 'sentry/types';
import {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import localStorage from 'sentry/utils/localStorage';
import withApi from 'sentry/utils/withApi';

const transformedAnomalyDevKey = 'dev.anomalyPayload.transformed';

type AnomaliesProps = {};
type RequestProps = DiscoverQueryProps & AnomaliesProps;

export type ChildrenProps = Omit<GenericChildrenProps<AnomaliesProps>, 'tableData'> & {
  data: AnomalyPayload | null;
};

type Props = RequestProps & {
  children: (props: ChildrenProps) => React.ReactNode;
};

type AnomalyConfidence = 'high' | 'low';

// Should match events stats data in format.
type AnomalyStatsData = {
  data: EventsStatsData;
  end?: number;
  start?: number;
};

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
  yhat_upper: AnomalyStatsData; // Anomaly info describes what the anomaly service determines is an 'anomaly area'.
};

function transformStatsTimes(stats: AnomalyStatsData) {
  stats.data.forEach(d => (d[0] = d[0] * 1000));
  stats.data = stats.data.slice((stats.data.length * 4) / 6, stats.data.length);
  return stats;
}
function transformAnomaliesTimes(anoms: AnomalyInfo[]) {
  anoms.forEach(a => {
    a.start = a.start * 1000;
    a.end = a.end * 1000;
  });
  return anoms;
}

/**
 * All this code is temporary while in development so a local dev env isn't required.
 * TODO(k-fish): Remove this after EA.
 */
function getLocalPayload(): AnomalyPayload | null {
  const rawTransformed = localStorage.getItem(transformedAnomalyDevKey);
  if (rawTransformed) {
    const transformedData: AnomalyPayload = JSON.parse(rawTransformed || '{}');

    if (transformedData) {
      transformedData.y = transformStatsTimes(transformedData.y);
      transformedData.yhat_upper = transformStatsTimes(transformedData.yhat_upper);
      transformedData.yhat_lower = transformStatsTimes(transformedData.yhat_lower);
      transformedData.anomalies = transformAnomaliesTimes(transformedData.anomalies);
      return transformedData;
    }
  }

  localStorage.setItem(transformedAnomalyDevKey, ''); // Set the key so it shows up automatically if this feature is enabled.

  return null;
}

function AnomaliesSeriesQuery(props: Props) {
  const data = getLocalPayload(); // TODO(k-fish): Replace with api request when service is enabled.

  return (
    <div>
      {props.children({
        data,
        isLoading: false,
        error: null,
        pageLinks: null,
      })}
    </div>
  );
}

export default withApi(AnomaliesSeriesQuery);
