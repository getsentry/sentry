import type {Location} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {TransactionFilterOptions} from 'sentry/views/performance/transactionSummary/utils';

import {
  decodeEventsDisplayFilterFromLocation,
  EventsDisplayFilterName,
  eventsRouteWithQuery,
} from './utils';

describe('Performance > Transaction Summary > Transaction Events > Utils', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});

  it('maps the default transaction summary filter to p95 on events route', () => {
    const route = eventsRouteWithQuery({
      organization,
      transaction: '/performance',
      query: {
        project: '1',
        query: 'user.email:test@example.com',
      },
    });

    expect(route.query.showTransactions).toBe(EventsDisplayFilterName.P95);
  });

  it('preserves percentile filters when routing to events', () => {
    const route = eventsRouteWithQuery({
      organization,
      transaction: '/performance',
      query: {
        project: '1',
        query: 'user.email:test@example.com',
        showTransactions: EventsDisplayFilterName.P50,
      },
    });

    expect(route.query.showTransactions).toBe(EventsDisplayFilterName.P50);
  });

  it('maps legacy transaction list filters to percentile filters', () => {
    const route = eventsRouteWithQuery({
      organization,
      transaction: '/performance',
      query: {
        project: '1',
        query: 'user.email:test@example.com',
        showTransactions: TransactionFilterOptions.SLOW,
      },
    });

    expect(route.query.showTransactions).toBe(EventsDisplayFilterName.P95);
  });

  it('decodes legacy location filters to percentile filters', () => {
    const decoded = decodeEventsDisplayFilterFromLocation({
      query: {showTransactions: TransactionFilterOptions.SLOW},
    } as Location);

    expect(decoded).toBe(EventsDisplayFilterName.P95);
  });
});
