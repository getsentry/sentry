import {Event} from './event';

export function Events(params = []) {
  return [
    Event({eventID: '12345', id: '1', message: 'ApiException', groupID: '1'}),
    Event({
      eventID: '12346',
      id: '2',
      message: 'TestException',
      groupID: '1',
    }),
    ...params,
  ];
}

export function EventsStats(query = {}, params) {
  return {
    data: [[new Date(), [{count: 321}, {count: 79}]], [new Date(), [{count: 123}]]],
    ...params,
  };
}
