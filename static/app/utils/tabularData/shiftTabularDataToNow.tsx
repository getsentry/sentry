import type {TabularData} from 'sentry/views/dashboards/widgets/common/types';

export function shiftTabularDataToNow(tabularData: TabularData): TabularData {
  const currentTimestamp = Date.now();

  const lastDatum = tabularData.data.at(-1);
  if (!lastDatum) {
    return tabularData;
  }

  if (!tabularData.data.every(datum => !!datum.timestamp)) {
    return tabularData;
  }

  const lastTimeStampInData = new Date(lastDatum.timestamp!).getTime();
  const diff = currentTimestamp - lastTimeStampInData;

  return {
    ...tabularData,
    data: tabularData.data.map(datum => ({
      ...datum,
      timestamp: new Date(new Date(datum.timestamp!).getTime() + diff).toISOString(),
    })),
  };
}
