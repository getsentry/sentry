import type {Client} from 'sentry/api';
import CommitterStore, {getCommitterStoreKey} from 'sentry/stores/committerStore';
import type {Committer, ReleaseCommitter} from 'sentry/types';

type ParamsGet = {
  eventId: string;
  orgSlug: string;
  projectSlug: string;
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
  CommitterStore.load(orgSlug, projectSlug, eventId);

  return api
    .requestPromise(path, {
      method: 'GET',
    })
    .then((res: {committers: Committer[]; releaseCommitters: ReleaseCommitter[]}) => {
      CommitterStore.loadSuccess(
        orgSlug,
        projectSlug,
        eventId,
        res.committers,
        res.releaseCommitters
      );
    })
    .catch(err => {
      // NOTE: Do not captureException here as EventFileCommittersEndpoint returns
      // 404 Not Found if the project did not setup Releases or Commits
      CommitterStore.loadError(orgSlug, projectSlug, eventId, err);
    });
}
