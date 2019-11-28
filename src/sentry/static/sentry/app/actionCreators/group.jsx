import * as Sentry from '@sentry/browser';

import {Client} from 'app/api';
import {buildUserId, buildTeamId} from 'app/utils';
import {uniqueId} from 'app/utils/guid';
import GroupActions from 'app/actions/groupActions';
import GroupStore from 'app/stores/groupStore';

export function assignToUser(params) {
  const api = new Client();

  const endpoint = `/issues/${params.id}/`;

  const id = uniqueId();

  GroupActions.assignTo(id, params.id, {
    email: (params.member && params.member.email) || '',
  });

  const request = api.requestPromise(endpoint, {
    method: 'PUT',
    // Sending an empty value to assignedTo is the same as "clear",
    // so if no member exists, that implies that we want to clear the
    // current assignee.
    data: {
      assignedTo: params.user ? buildUserId(params.user.id) : '',
    },
  });

  request
    .then(data => {
      GroupActions.assignToSuccess(id, params.id, data);
    })
    .catch(data => {
      GroupActions.assignToError(id, params.id, data);
    });

  return request;
}

export function clearAssignment(groupId) {
  const api = new Client();

  const endpoint = `/issues/${groupId}/`;

  const id = uniqueId();

  GroupActions.assignTo(id, groupId, {
    email: '',
  });

  const request = api.requestPromise(endpoint, {
    method: 'PUT',
    // Sending an empty value to assignedTo is the same as "clear"
    data: {
      assignedTo: '',
    },
  });

  request
    .then(data => {
      GroupActions.assignToSuccess(id, groupId, data);
    })
    .catch(data => {
      GroupActions.assignToError(id, groupId, data);
    });

  return request;
}

export function assignToActor({id, actor}) {
  const api = new Client();

  const endpoint = `/issues/${id}/`;

  const guid = uniqueId();
  let actorId;

  GroupActions.assignTo(guid, id, {email: ''});

  switch (actor.type) {
    case 'user':
      actorId = buildUserId(actor.id);
      break;

    case 'team':
      actorId = buildTeamId(actor.id);
      break;

    default:
      Sentry.withScope(scope => {
        scope.setExtra('actor', actor);
        Sentry.captureException('Unknown assignee type');
      });
  }

  return api
    .requestPromise(endpoint, {
      method: 'PUT',
      data: {assignedTo: actorId},
    })
    .then(data => {
      GroupActions.assignToSuccess(guid, id, data);
    })
    .catch(data => {
      GroupActions.assignToError(guid, id, data);
    });
}

export function deleteNote(api, group, id, oldText) {
  const index = GroupStore.removeActivity(group.id, id);
  if (index === -1) {
    // I dunno, the id wasn't found in the GroupStore
    return Promise.reject(new Error('Group was not found in store'));
  }

  const promise = api.requestPromise(`/issues/${group.id}/comments/${id}/`, {
    method: 'DELETE',
  });

  promise.catch(() =>
    GroupStore.addActivity(group.id, {id, data: {text: oldText}}, index)
  );

  return promise;
}

export function createNote(api, group, note) {
  const promise = api.requestPromise(`/issues/${group.id}/comments/`, {
    method: 'POST',
    data: note,
  });

  promise.then(data => GroupStore.addActivity(group.id, data));

  return promise;
}

export function updateNote(api, group, note, id, oldText) {
  GroupStore.updateActivity(group.id, id, {text: note.text});

  const promise = api.requestPromise(`/issues/${group.id}/comments/${id}/`, {
    method: 'PUT',
    data: note,
  });

  promise.catch(() => GroupStore.updateActivity(group.id, id, {text: oldText}));

  return promise;
}
