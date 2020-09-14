export function EventEntry(params) {
  return {
    id: '1',
    type: 'message',
    data: {
      formatted: 'Blocked script',
    },
    ...params,
  };
}
