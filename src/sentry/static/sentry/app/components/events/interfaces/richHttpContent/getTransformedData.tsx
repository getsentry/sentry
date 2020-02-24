import {defined} from 'app/utils';

function getTransformedData(data: any) {
  if (Array.isArray(data)) {
    return data.filter(dataValue => defined(dataValue));
  }

  if (typeof data === 'object') {
    return Object.keys(data).map(key => [key, data[key]]);
  }

  return [];
}

export default getTransformedData;
