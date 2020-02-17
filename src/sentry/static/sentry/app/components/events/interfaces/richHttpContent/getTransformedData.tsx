function getTransformedData(data: any) {
  if (Array.isArray(data)) {
    return data;
  }

  if (typeof data === 'object') {
    Object.keys(data).map(key => [key, data[key]]);
  }

  return [];
}

export default getTransformedData;
