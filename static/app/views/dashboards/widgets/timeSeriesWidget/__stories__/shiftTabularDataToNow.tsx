import isValidDate from 'sentry/utils/date/isValidDate';
import type {TabularData} from 'sentry/views/dashboards/widgets/common/types';

export function shiftTabularDataToNow(tabularData: TabularData): TabularData {
  const currentTimestamp = Date.now();

  const lastTimestampValue = tabularData.data.at(-1)?.timestamp;
  // @ts-expect-error: TypeScript pretends like `Date` doesn't accept `undefined`, but it does
  const lastDatumDate = new Date(lastTimestampValue);
  if (!isValidDate(lastDatumDate)) {
    return tabularData;
  }

  const diff = currentTimestamp - lastDatumDate.getTime();

  if (diff === 0) {
    return tabularData;
  }

  return {
    ...tabularData,
    data: tabularData.data.map(datum => {
      const timestampValue = datum.timestamp;
      // @ts-expect-error: TypeScript pretends like `Date` doesn't accept `undefined`, but it does
      const timestampDate = new Date(timestampValue);
      if (!isValidDate(timestampDate)) {
        return datum;
      }

      return {
        ...datum,
        timestamp: new Date(timestampDate.getTime() + diff).toISOString(),
      };
    }),
  };
}
