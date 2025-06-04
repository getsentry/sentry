import {defined} from 'sentry/utils';

function getTransformedData(data: any, meta: Record<any, any> | undefined) {
  if (Array.isArray(data)) {
    return data
      .filter(dataValue => {
        if (typeof dataValue === 'string') {
          return !!dataValue;
        }

        return defined(dataValue);
      })
      .map((dataValue, index) => {
        if (Array.isArray(dataValue)) {
          return {
            data: dataValue,
            meta: meta?.[index]?.[1]?.[1]?.[''],
          };
        }

        if (typeof data === 'object') {
          return {
            data: Object.keys(dataValue).flatMap(key => [key, dataValue[key]]),
          };
        }

        return {
          data: dataValue,
        };
      });
  }

  if (typeof data === 'object') {
    return Object.keys(data).map(key => {
      return {
        data: [key, data[key]],
        meta: meta?.[key]?.[''],
      };
    });
  }

  return [];
}

export default getTransformedData;
