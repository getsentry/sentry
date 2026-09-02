import {makeTestQueryClient} from 'sentry-test/queryClient';

import {getInvestigationDetailQueryOptions} from 'sentry/views/investigations/api';
import {updateInvestigationCache} from 'sentry/views/investigations/investigationCache';
import type {InvestigationDetail} from 'sentry/views/investigations/types';

const investigation: InvestigationDetail = {
  blockCount: 1,
  createdBy: '1',
  dateCreated: '2026-08-13T20:00:00Z',
  dateUpdated: '2026-08-13T21:00:00Z',
  id: 'investigation-1',
  isFavorited: false,
  sourceType: 'manual',
  status: 'active',
  summary: null,
  summaryDescription: null,
  title: 'Investigate database latency',
  version: 1,
};

describe('updateInvestigationCache', () => {
  it('immutably updates the response JSON and preserves headers', () => {
    const queryClient = makeTestQueryClient();
    const options = getInvestigationDetailQueryOptions('org-slug', 'investigation-1');
    const cachedResponse = {
      headers: {Link: 'preserved'},
      json: investigation,
    };
    queryClient.setQueryData(options.queryKey, cachedResponse);

    updateInvestigationCache(queryClient, 'org-slug', 'investigation-1', current => ({
      ...current,
      isFavorited: true,
    }));

    const updatedResponse = queryClient.getQueryData(options.queryKey);
    expect(updatedResponse).toEqual({
      headers: {Link: 'preserved'},
      json: {...investigation, isFavorited: true},
    });
    expect(updatedResponse).not.toBe(cachedResponse);
    expect(updatedResponse?.headers).toBe(cachedResponse.headers);
    expect(updatedResponse?.json).not.toBe(investigation);
  });

  it('does not seed a partial investigation when the query is not cached', () => {
    const queryClient = makeTestQueryClient();
    const options = getInvestigationDetailQueryOptions('org-slug', 'investigation-1');
    const update = jest.fn((current: InvestigationDetail) => current);

    updateInvestigationCache(queryClient, 'org-slug', 'investigation-1', update);

    expect(queryClient.getQueryData(options.queryKey)).toBeUndefined();
    expect(update).not.toHaveBeenCalled();
  });
});
