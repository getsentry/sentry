import {initializeOrg} from 'sentry-test/initializeOrg';

import {DisplayModes} from 'app/utils/discover/types';
import {Dataset} from 'app/views/settings/incidentRules/types';
import {PRESET_AGGREGATES} from 'app/views/settings/incidentRules/presets';
import {getIncidentDiscoverUrl} from 'app/views/alerts/utils';
import {transactionSummaryRouteWithQuery} from 'app/views/performance/transactionSummary/utils';

jest.mock('app/views/performance/transactionSummary/utils', () => ({
  transactionSummaryRouteWithQuery: jest.fn(),
}));

jest.mock('app/views/alerts/utils', () => {
  const actual = jest.requireActual('app/views/alerts/utils');
  return {
    ...actual,
    getIncidentDiscoverUrl: jest.fn(),
  };
});

describe('Incident Presets', function() {
  const {org, projects} = initializeOrg();

  const mockStats = {
    eventStats: {
      data: [
        [0, 10],
        [120, 10],
      ],
    },
  };

  const findPresetByName = name => PRESET_AGGREGATES.find(p => p.name === name);

  describe('CTAs', function() {
    beforeEach(function() {
      getIncidentDiscoverUrl.mockClear();
    });

    it('creates the CTA for error count', function() {
      const preset = findPresetByName('Error count');

      const incident = {
        title: 'Test error alert',
        discoverQuery: 'id:test',
        projects,
        alertRule: {
          dataset: Dataset.ERRORS,
          aggregate: 'count()',
        },
      };

      const cta = preset.makeCtaParams({
        orgSlug: org.slug,
        projects,
        incident,
        stats: mockStats,
      });

      expect(getIncidentDiscoverUrl).toHaveBeenCalledWith({
        orgSlug: org.slug,
        projects,
        incident,
        stats: mockStats,
        extraQueryParams: {
          display: DisplayModes.TOP5,
        },
      });

      expect(cta).toEqual(
        expect.objectContaining({
          buttonText: 'Open in Discover',
        })
      );
    });

    it('creates the CTA for unique user count', function() {
      const preset = findPresetByName('Users affected');

      const incident = {
        title: 'Test error alert',
        discoverQuery: 'id:test',
        projects,
        alertRule: {
          dataset: Dataset.ERRORS,
          aggregate: 'count_unique(user)',
        },
      };

      const cta = preset.makeCtaParams({
        orgSlug: org.slug,
        projects,
        incident,
        stats: mockStats,
      });

      expect(getIncidentDiscoverUrl).toHaveBeenCalledWith({
        orgSlug: org.slug,
        projects,
        incident,
        stats: mockStats,
        extraQueryParams: {
          display: DisplayModes.TOP5,
        },
      });

      expect(cta).toEqual(
        expect.objectContaining({
          buttonText: 'Open in Discover',
        })
      );
    });

    describe('Latency CTA', function() {
      const preset = findPresetByName('Latency');

      it('creates the CTA for multiple transaction latency', function() {
        // Incident rule WITHOUT a specific transaction
        const incident = {
          title: 'Test error alert',
          discoverQuery: 'id:test transaction:*',
          projects,
          alertRule: {
            dataset: Dataset.ERRORS,
            aggregate: 'p95()',
          },
        };

        const allTransactionCta = preset.makeCtaParams({
          orgSlug: org.slug,
          projects,
          incident,
          stats: mockStats,
        });

        expect(getIncidentDiscoverUrl).toHaveBeenCalledWith({
          orgSlug: org.slug,
          projects,
          incident,
          stats: mockStats,
          extraQueryParams: {
            display: DisplayModes.TOP5,
            fields: ['transaction', 'count()', 'p95()'],
            orderby: '-count',
          },
        });

        expect(allTransactionCta).toEqual(
          expect.objectContaining({
            buttonText: 'Open in Discover',
            title: 'Latency by Transaction',
          })
        );
      });

      it('creates the CTA for a specific transaction latency', function() {
        // Incident rule WITH a specific transaction
        const incident = {
          title: 'Test error alert',
          discoverQuery: 'id:test transaction:do_work',
          projects,
          alertRule: {
            dataset: Dataset.ERRORS,
            aggregate: 'p95()',
          },
        };

        const specificTransactionCta = preset.makeCtaParams({
          orgSlug: org.slug,
          projects,
          incident,
          stats: mockStats,
        });

        expect(transactionSummaryRouteWithQuery).toHaveBeenCalledWith({
          orgSlug: org.slug,
          transaction: 'do_work',
          projectID: [],
          query: {
            start: '1970-01-01T00:00:00',
            end: '1970-01-01T00:02:00',
          },
        });

        expect(specificTransactionCta).toEqual(
          expect.objectContaining({
            buttonText: 'View Transaction Summary',
            title: 'do_work',
          })
        );
      });
    });

    describe('Apdex CTA', function() {
      const preset = findPresetByName('Apdex');

      it('creates the CTA for multiple transaction apdex', function() {
        // Incident rule WITHOUT a specific transaction
        const incident = {
          title: 'Test error alert',
          discoverQuery: 'id:test transaction:*',
          projects,
          alertRule: {
            dataset: Dataset.ERRORS,
            aggregate: 'apdex(300)',
          },
        };

        const allTransactionCta = preset.makeCtaParams({
          orgSlug: org.slug,
          projects,
          incident,
          stats: mockStats,
        });

        expect(getIncidentDiscoverUrl).toHaveBeenCalledWith({
          orgSlug: org.slug,
          projects,
          incident,
          stats: mockStats,
          extraQueryParams: {
            display: DisplayModes.TOP5,
            fields: ['transaction', 'count()', 'apdex(300)'],
            orderby: '-count',
          },
        });

        expect(allTransactionCta).toEqual(
          expect.objectContaining({
            buttonText: 'Open in Discover',
            title: 'Apdex by Transaction',
          })
        );
      });

      it('creates the CTA for a specific transaction apdex', function() {
        // Incident rule WITH a specific transaction
        const incident = {
          title: 'Test error alert',
          discoverQuery: 'id:test transaction:do_work',
          projects,
          alertRule: {
            dataset: Dataset.ERRORS,
            aggregate: 'apdex(300)',
          },
        };

        const specificTransactionCta = preset.makeCtaParams({
          orgSlug: org.slug,
          projects,
          incident,
          stats: mockStats,
        });

        expect(transactionSummaryRouteWithQuery).toHaveBeenCalledWith({
          orgSlug: org.slug,
          transaction: 'do_work',
          projectID: [],
          query: {
            start: '1970-01-01T00:00:00',
            end: '1970-01-01T00:02:00',
          },
        });

        expect(specificTransactionCta).toEqual(
          expect.objectContaining({
            buttonText: 'View Transaction Summary',
            title: 'do_work',
          })
        );
      });
    });

    describe('Transaction count CTA', function() {
      const preset = findPresetByName('Transaction Count');

      it('creates the CTA for multiple transaction counts', function() {
        // Incident rule WITHOUT a specific transaction
        const incident = {
          title: 'Test error alert',
          discoverQuery: 'id:test transaction:*',
          projects,
          alertRule: {
            dataset: Dataset.ERRORS,
            aggregate: 'count()',
          },
        };

        const allTransactionCta = preset.makeCtaParams({
          orgSlug: org.slug,
          projects,
          incident,
          stats: mockStats,
        });

        expect(getIncidentDiscoverUrl).toHaveBeenCalledWith({
          orgSlug: org.slug,
          projects,
          incident,
          stats: mockStats,
          extraQueryParams: {
            display: DisplayModes.TOP5,
            fields: ['transaction', 'count()'],
            orderby: '-count',
          },
        });

        expect(allTransactionCta).toEqual(
          expect.objectContaining({
            buttonText: 'Open in Discover',
          })
        );
      });

      it('creates the CTA for a specific transaction count', function() {
        // Incident rule WITH a specific transaction
        const incident = {
          title: 'Test error alert',
          discoverQuery: 'id:test transaction:do_work',
          projects,
          alertRule: {
            dataset: Dataset.ERRORS,
            aggregate: 'count()',
          },
        };

        const specificTransactionCta = preset.makeCtaParams({
          orgSlug: org.slug,
          projects,
          incident,
          stats: mockStats,
        });

        expect(transactionSummaryRouteWithQuery).toHaveBeenCalledWith({
          orgSlug: org.slug,
          transaction: 'do_work',
          projectID: [],
          query: {
            start: '1970-01-01T00:00:00',
            end: '1970-01-01T00:02:00',
          },
        });

        expect(specificTransactionCta).toEqual(
          expect.objectContaining({
            buttonText: 'View Transaction Summary',
          })
        );
      });
    });

    describe('Failure rate CTA', function() {
      const preset = findPresetByName('Failure rate');

      it('creates the CTA for multiple transaction failure rates', function() {
        // Incident rule WITHOUT a specific transaction
        const incident = {
          title: 'Test error alert',
          discoverQuery: 'id:test transaction:*',
          projects,
          alertRule: {
            dataset: Dataset.ERRORS,
            aggregate: 'count()',
          },
        };

        const allTransactionCta = preset.makeCtaParams({
          orgSlug: org.slug,
          projects,
          incident,
          stats: mockStats,
        });

        expect(getIncidentDiscoverUrl).toHaveBeenCalledWith({
          orgSlug: org.slug,
          projects,
          incident,
          stats: mockStats,
          extraQueryParams: {
            display: DisplayModes.TOP5,
            fields: ['transaction', 'failure_rate()'],
            orderby: '-failure_rate',
          },
        });

        expect(allTransactionCta).toEqual(
          expect.objectContaining({
            buttonText: 'Open in Discover',
            title: 'Failure rate by transaction',
          })
        );
      });

      it('creates the CTA for a specific transaction count', function() {
        // Incident rule WITH a specific transaction
        const incident = {
          title: 'Test error alert',
          discoverQuery: 'id:test transaction:do_work',
          projects,
          alertRule: {
            dataset: Dataset.ERRORS,
            aggregate: 'count()',
          },
        };

        const specificTransactionCta = preset.makeCtaParams({
          orgSlug: org.slug,
          projects,
          incident,
          stats: mockStats,
        });

        expect(getIncidentDiscoverUrl).toHaveBeenCalledWith({
          orgSlug: org.slug,
          projects,
          incident,
          stats: mockStats,
          extraQueryParams: {
            display: DisplayModes.TOP5,
            fields: ['transaction.status', 'count()'],
            orderby: '-count',
          },
        });

        expect(specificTransactionCta).toEqual(
          expect.objectContaining({
            buttonText: 'Open in Discover',
          })
        );
      });
    });
  });
});
