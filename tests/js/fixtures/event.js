export function Event(params) {
  return {
    id: '1',
    message: 'ApiException',
    groupID: '1',
    eventID: '12345678901234567890123456789012',
    ...params,
  };
}
