import {Client} from '../api';
import GroupActions from '../actions/groupActions';

export function assignTo(params) {
  const api = new Client();

  let endpoint = `/issues/${params.id}/`;

  let id = api.uniqueId();

  GroupActions.assignTo(id, params.id, {
    email: (params.member && params.member.email) || '',
  });

  return new Promise((resolve, reject) =>
    api.request(endpoint, {
      method: 'PUT',
      // Sending an empty value to assignedTo is the same as "clear",
      // so if no member exists, that implies that we want to clear the
      // current assignee.
      data: {assignedTo: (params.member && params.member.id) || ''},

      success: data => {
        GroupActions.assignToSuccess(id, params.id, data);
        resolve(data);
      },
      error: data => {
        GroupActions.assignTodata(id, params.id, data);
        reject(data);
      },
    })
  );
}

export default {assignTo};
