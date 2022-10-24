const {Event} = require('./event');
const {Group} = require('./group');
const {User} = require('./user');

module.exports.UserFeedback = function (params = {}) {
  const event = Event();
  return {
    id: '123',
    name: 'Lyn',
    email: 'lyn@sentry.io',
    comments: 'Something bad happened',
    dateCreated: '2018-12-20T00:00:00.000Z',
    issue: Group(),
    eventID: event.id,
    event,
    user: User(),
    ...params,
  };
};
