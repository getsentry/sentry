import type {SavedQuery} from 'sentry/types/organization';
import { SavedQueryDatasets } from 'sentry/utils/discover/types';

export function DiscoverSavedQueryFixture(params = {}): SavedQuery {
  return {
    id: '1',
    name: 'Saved query #1',
    dateCreated: '2018-09-24T00:00:00.000Z',
    dateUpdated: '2018-09-24T00:00:00.000Z',
    fields: ['test'],
    version: 2,
    queryDataset: SavedQueryDatasets.TRANSACTIONS,
    ...params,
  };
}
