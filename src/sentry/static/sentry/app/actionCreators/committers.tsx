import CommitterActions from 'app/actions/committerActions';
import {Client} from 'app/api';
import CommitterStore, {getCommitterStoreKey} from 'app/stores/committerStore';
import {Committer} from 'app/types';

type ParamsGet = {
  orgSlug: string;
  projectSlug: string;
  eventId: string;
};

export function getCommitters(api: Client, params: ParamsGet) {
  const {orgSlug, projectSlug, eventId} = params;
  const path = `/projects/${orgSlug}/${projectSlug}/events/${eventId}/committers/`;

  // HACK(leedongwei): Actions fired by the ActionCreators are queued to
  // the back of the event loop, allowing another getRepo for the same
  // repo to be fired before the loading state is updated in store.
  // This hack short-circuits that and update the state immediately.
  const storeKey = getCommitterStoreKey(orgSlug, projectSlug, eventId);
  CommitterStore.state[storeKey] = {
    ...CommitterStore.state[storeKey],
    committersLoading: true,
  };
  CommitterActions.load(orgSlug, projectSlug, eventId);

  return api
    .requestPromise(path, {
      method: 'GET',
    })
    .then((res: {committers: Committer[]}) => {
      CommitterActions.loadSuccess(orgSlug, projectSlug, eventId, res.committers);
    })
    .catch(err => {
      // NOTE: Do not captureException here as EventFileCommittersEndpoint returns
      // 404 Not Found if the project did not setup Releases or Commits
      CommitterActions.loadError(orgSlug, projectSlug, eventId, err);
    });
}
