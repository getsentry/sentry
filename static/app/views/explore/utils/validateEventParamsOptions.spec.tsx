import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {parseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {TraceItemDataset} from 'sentry/views/explore/types';

import {validateEventParamsOptions} from './validateEventParamsOptions';

const organization = OrganizationFixture({slug: 'org-slug'});

describe('validateEventParamsOptions', () => {
  it('builds validation query params from page filters and explicit fields', () => {
    const selection = PageFiltersFixture({
      datetime: {period: '14d', start: null, end: null, utc: false},
      environments: ['production'],
      projects: [1, 2],
    });

    const options = validateEventParamsOptions({
      organization,
      selection,
      traceItemType: TraceItemDataset.SPANS,
      field: ['span.op', 'avg(span.duration)'],
      orderBy: ['-timestamp'],
      query: 'span.op:http',
    });

    expect(parseQueryKey(options.queryKey).url).toBe(
      '/organizations/org-slug/events/validate/'
    );
    expect(parseQueryKey(options.queryKey).options).toEqual(
      expect.objectContaining({
        query: {
          dataset: TraceItemDataset.SPANS,
          environment: ['production'],
          field: ['span.op', 'avg(span.duration)'],
          orderby: ['-timestamp'],
          project: ['1', '2'],
          query: 'span.op:http',
          statsPeriod: '14d',
        },
      })
    );
  });

  it('prefers explicit project ids over selected projects', () => {
    const selection = PageFiltersFixture({projects: [1]});

    const options = validateEventParamsOptions({
      organization,
      selection,
      traceItemType: TraceItemDataset.LOGS,
      projectIds: [2, 3],
    });

    expect(options.queryKey).toEqual([
      '_api',
      expect.objectContaining({
        url: '/organizations/org-slug/events/validate/',
        options: expect.objectContaining({
          query: expect.objectContaining({
            dataset: TraceItemDataset.LOGS,
            project: ['2', '3'],
          }),
        }),
      }),
    ]);
  });
});
