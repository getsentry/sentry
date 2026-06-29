import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {TraceItemDataset} from 'sentry/views/explore/types';
import {validateEventParamsOptions} from 'sentry/views/explore/utils/validateEventParamsOptions';

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

    expect(options.queryKey).toEqual([
      '/organizations/org-slug/events/validate/',
      {
        query: {
          dataset: TraceItemDataset.SPANS,
          environment: ['production'],
          field: ['span.op', 'avg(span.duration)'],
          orderby: ['-timestamp'],
          project: ['1', '2'],
          query: 'span.op:http',
          statsPeriod: '14d',
        },
      },
      {infinite: false},
    ]);
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
      '/organizations/org-slug/events/validate/',
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: TraceItemDataset.LOGS,
          project: ['2', '3'],
        }),
      }),
      {infinite: false},
    ]);
  });
});
