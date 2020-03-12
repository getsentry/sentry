import {Client} from 'app/api';

export const deleteRelease = (orgId: string, version: string) => {
  const api = new Client();

  return api.requestPromise(
    `/organizations/${orgId}/releases/${encodeURIComponent(version)}/`,
    {
      method: 'DELETE',
    }
  );
};
