import {defined} from 'app/utils';

function getTransformedData(data: any) {
  if (Array.isArray(data)) {
    return data
      .filter(dataValue => defined(dataValue))
      .map(dataValue => {
        if (Array.isArray(dataValue)) {
          return dataValue;
        }
        if (typeof data === 'object') {
          return Object.keys(dataValue).flatMap(key => [key, dataValue[key]]);
        }
        return dataValue;
      });
  }

  return [];
}

export default getTransformedData;
