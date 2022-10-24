const {User} = require('./user');

module.exports.IncidentActivity = function (params = {}) {
  return {
    comment: 'incident activity comment',
    type: 3,
    dateCreated: new Date(),
    user: User(),
    id: '123',
    incidentIdentifier: '999',
    ...params,
  };
};
