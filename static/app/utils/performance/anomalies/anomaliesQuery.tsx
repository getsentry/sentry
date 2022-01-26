import {EventsStatsData} from 'sentry/types';
import {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import localStorage from 'sentry/utils/localStorage';
import withApi from 'sentry/utils/withApi';

const anomalyDevKey = 'dev.anomalyPayload';
const transformedAnomalyDevKey = 'dev.anomalyPayload.transformed';

type AnomaliesProps = {};

type AnomRawField = {
  [key: string]: number;
};

type AnomalyRawData = {
  ds: AnomRawField;
  yhat_lower: AnomRawField;
  yhat_upper: AnomRawField;
  y: AnomRawField;
  score: AnomRawField;
  scaled_score: AnomRawField;
  final_score: AnomRawField;
};

type RequestProps = DiscoverQueryProps & AnomaliesProps;

export type ChildrenProps = Omit<GenericChildrenProps<AnomaliesProps>, 'tableData'> & {
  data: AnomalyPayload | null;
};

type Props = RequestProps & {
  children: (props: ChildrenProps) => React.ReactNode;
};

type AnomalyConfidence = 'high' | 'low';

type AnomalyStatsData = {
  data: EventsStatsData;
  start?: number;
  end?: number;
};

type AnomArea = {
  id: number;
  name?: string;
  confidence: AnomalyConfidence;
  start: number;
  end?: number;
  scoreTotal: number;
  count: number;
};

export type AnomalyInfo = {
  confidence: AnomalyConfidence;
  start: number;
  end: number;
  id: string;
  expected: number;
  received: number;
};

type AnomalyData = {
  data: AnomalyInfo[];
};

export type AnomalyPayload = {
  y: AnomalyStatsData;
  yhat_upper: AnomalyStatsData;
  yhat_lower: AnomalyStatsData;
  anomalies: AnomalyData;
};

/**
 * TODO(k-fish): Remove this after api format is stabilized.
 */
const generateAnomalyAreas = (anomalyData: AnomalyRawData) => {
  const areas: AnomalyInfo[] = [];
  let id = 0;
  let currentArea: AnomArea | null = null;

  for (const [key, value] of Object.entries(anomalyData.ds)) {
    const y = anomalyData.y[key];
    const lower = anomalyData.yhat_lower[key];
    const upper = anomalyData.yhat_upper[key];
    const score = anomalyData.final_score[key];

    if (y < lower || y > upper) {
      if (!currentArea) {
        if (score > 0.4) {
          id++;
          currentArea = {
            id,
            name: `#${id}`,
            start: value,
            confidence: 'low',
            count: 1,
            scoreTotal: score,
          };
        }
      } else {
        currentArea.count += 1;
        currentArea.scoreTotal += score;
      }
    } else {
      if (currentArea) {
        //
        currentArea.end = value;

        const scoreAverage = currentArea.scoreTotal / currentArea.count;
        if (scoreAverage > 1) {
          currentArea.confidence = 'high';
        }

        areas.push({
          start: currentArea.start,
          end: currentArea.end,
          id: `${currentArea.id}`,
          confidence: currentArea.confidence,
          expected: 0,
          received: 0,
        });
        currentArea = null;
      }
    }
  }

  if (currentArea) {
    currentArea.end = Object.values(anomalyData.ds)[-1];

    areas.push({
      start: currentArea.start,
      end: currentArea.end,
      id: `${currentArea.id}`,
      confidence: currentArea.confidence,
      expected: 0,
      received: 0,
    });
  }

  return {data: areas};
};

/**
 * All this code is temporary while in development so a local dev env isn't required.
 * TODO(k-fish): Remove this after EA.
 */
function getLocalPayload(): AnomalyPayload | null {
  const rawTransformed = localStorage.getItem(transformedAnomalyDevKey);
  if (rawTransformed) {
    const transformedData: AnomalyPayload = JSON.parse(rawTransformed || '{}');

    if (transformedData) {
      return transformedData;
    }
  }

  localStorage.setItem(transformedAnomalyDevKey, ''); // Set the key so it shows up automatically if this feature is enabled.

  const rawData = localStorage.getItem(anomalyDevKey);

  if (!rawData) {
    localStorage.setItem(anomalyDevKey, '');
    return null;
  }

  try {
    const data = JSON.parse(rawData || '{}');

    if (data) {
      return transformRawAnomalyData(data);
    }
  } catch (_) {
    //
  }

  return null;
}

// Uses the older format with timestamps and counts in their own separate objs.
function transformRawAnomalyData(data: AnomalyRawData): AnomalyPayload {
  const newData: any = {
    ds: {},
    y: {},
    yhat_lower: {},
    yhat_upper: {},
    scaled_score: {},
    score: {},
    final_score: {},
  };

  // Simple smoothing for raw data with high bucket counts.
  Object.keys(data).forEach(key => {
    const obj = data[key];

    const valueArray = Object.values(obj);

    const newObj = {};

    let counter = 0;

    for (let i = 0; i < valueArray.length; i += 6) {
      newObj[counter] = valueArray[i];
      counter++;
    }

    newData[key] = newObj;
  });

  const yData = Object.entries(newData.ds).map(([key, value]) => [
    value,
    [{count: newData.y[key]}],
  ]) as any;
  const yUppperData = Object.entries(newData.ds).map(([key, value]) => [
    value,
    [{count: newData.yhat_upper[key]}],
  ]) as any;
  const yLowerData = Object.entries(newData.ds).map(([key, value]) => [
    value,
    [{count: newData.yhat_lower[key]}],
  ]) as any;

  const payload: AnomalyPayload = {
    y: {data: yData},
    yhat_upper: {data: yUppperData},
    yhat_lower: {data: yLowerData},
    anomalies: generateAnomalyAreas(newData),
  };

  return payload;
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
