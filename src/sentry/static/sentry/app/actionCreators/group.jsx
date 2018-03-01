import {Client} from '../api';
import GroupActions from '../actions/groupActions';
import {buildUserId, buildTeamId} from '../utils';

export function assignToUser(params) {
  const api = new Client();

  let endpoint = `/issues/${params.id}/`;

  let id = api.uniqueId();

  GroupActions.assignTo(id, params.id, {
    email: (params.member && params.member.email) || '',
  });

  let request = api.requestPromise(endpoint, {
    method: 'PUT',
    // Sending an empty value to assignedTo is the same as "clear",
    // so if no member exists, that implies that we want to clear the
    // current assignee.
    data: {assignedTo: (params.member && buildUserId(params.member.id)) || ''},
  });

  request
    .then(data => {
      GroupActions.assignToSuccess(id, params.id, data);
    })
    .catch(data => {
      GroupActions.assignTodata(id, params.id, data);
    });

  return request;
}

export function assignToActor({id, actor}) {
  const api = new Client();

  let endpoint = `/issues/${id}/`;

  let unique_id = api.uniqueId();
  let actorId;
  switch (actor.type) {
    case 'user':
      actorId = buildUserId(actor.id);
      break;

    case 'team':
      actorId = buildTeamId(actor.id);
      break;

    default:
      Raven.captureException('Unknown type');
  }
  //TODO maxbittker deal with ramifications of sending teams here
  // GroupActions.assignTo(id, params.id, {
  //   email: (params.member && params.member.email) || '',
  // });

  let request = api.requestPromise(endpoint, {
    method: 'PUT',
    // Sending an empty value to assignedTo is the same as "clear",
    // so if no member exists, that implies that we want to clear the
    // current assignee.
    data: {assignedTo: actorId || ''},
  });

  request
    .then(data => {
      GroupActions.assignToSuccess(unique_id, id, data);
    })
    .catch(data => {
      GroupActions.assignTodata(unique_id, id, data);
    });

  return request;
}
