const {Member} = require('./member');
const {Team} = require('./team');

module.exports.AccessRequest = function (params = {}) {
  return {
    id: '123',
    member: Member(),
    team: Team(),
    requester: null,
    ...params,
  };
};
