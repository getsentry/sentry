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
