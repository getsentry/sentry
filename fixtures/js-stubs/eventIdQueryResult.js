const {Event} = require('./event');

module.exports.EventIdQueryResult = function (params = {}) {
  const event = Event({
    metadata: {
      type: 'event type',
      value: 'event description',
    },
  });
  return {
    organizationSlug: 'org-slug',
    projectSlug: 'project-slug',
    groupId: event.groupID,
    eventId: event.eventID,
    event,
    ...params,
  };
};
