import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import {TOP_N} from 'sentry/utils/discover/types';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';

import type {Widget} from '../types';
import {DisplayType, WidgetType} from '../types';

export type WidgetTemplate = Widget & {
  description: string;
};

export const getDefaultWidgets = (organization: Organization) => {
  const isSelfHostedErrorsOnly = ConfigStore.get('isSelfHostedErrorsOnly');
  const transactionsWidgets = [
    {
      id: 'duration-distribution',
      title: t('Duration Distribution'),
      description: t('Compare transaction durations across different percentiles.'),
      displayType: DisplayType.LINE,
      widgetType: organization.features.includes('performance-discover-dataset-selector')
        ? WidgetType.TRANSACTIONS
        : WidgetType.DISCOVER,
      interval: '5m',
      queries: [
        {
          name: '',
          conditions: hasDatasetSelector(organization) ? '' : 'event.type:transaction',
          fields: [
            'p50(transaction.duration)',
            'p75(transaction.duration)',
            'p95(transaction.duration)',
          ],
          aggregates: [
            'p50(transaction.duration)',
            'p75(transaction.duration)',
            'p95(transaction.duration)',
          ],
          columns: [],
          orderby: '',
        },
      ],
    },
    {
      id: 'high-throughput-transactions',
      title: t('High Throughput Transactions'),
      description: t('Top 5 transactions with the largest volume.'),
      displayType: DisplayType.TOP_N,
      widgetType: organization.features.includes('performance-discover-dataset-selector')
        ? WidgetType.TRANSACTIONS
        : WidgetType.DISCOVER,
      interval: '5m',
      queries: [
        {
          name: '',
          conditions: hasDatasetSelector(organization) ? '' : 'event.type:transaction',
          fields: ['transaction', 'count()'],
          aggregates: ['count()'],
          columns: ['transaction'],
          orderby: '-count()',
        },
      ],
    },
    {
      id: 'crash-rates-recent-releases',
      title: t('Crash Rates for Recent Releases'),
      description: t('Percentage of crashed sessions for latest releases.'),
      displayType: DisplayType.LINE,
      widgetType: WidgetType.RELEASE,
      interval: '5m',
      limit: 8,
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['crash_rate(session)', 'release'],
          aggregates: ['crash_rate(session)'],
          columns: ['release'],
          orderby: '-release',
        },
      ],
    },
    {
      id: 'session-health',
      title: t('Session Health'),
      description: t('Number of abnormal, crashed, errored and healthy sessions.'),
      displayType: DisplayType.TABLE,
      widgetType: WidgetType.RELEASE,
      interval: '5m',
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['session.status', 'sum(session)'],
          aggregates: ['sum(session)'],
          columns: ['session.status'],
          orderby: '-sum(session)',
        },
      ],
    },
    {
      id: 'lcp-country',
      title: t('LCP by Country'),
      description: t('Table showing page load times by country.'),
      displayType: DisplayType.TABLE,
      widgetType: organization.features.includes('performance-discover-dataset-selector')
        ? WidgetType.TRANSACTIONS
        : WidgetType.DISCOVER,
      interval: '5m',
      queries: [
        {
          name: '',
          conditions: 'has:geo.country_code',
          fields: ['geo.country_code', 'geo.region', 'p75(measurements.lcp)'],
          aggregates: ['p75(measurements.lcp)'],
          columns: ['geo.country_code', 'geo.region'],
          orderby: '-p75(measurements.lcp)',
        },
      ],
    },
    {
      id: 'miserable-users',
      title: t('Miserable Users'),
      description: t('Unique users who have experienced slow load times.'),
      displayType: DisplayType.BIG_NUMBER,
      widgetType: organization.features.includes('performance-discover-dataset-selector')
        ? WidgetType.TRANSACTIONS
        : WidgetType.DISCOVER,
      interval: '5m',
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['count_miserable(user,300)'],
          aggregates: ['count_miserable(user,300)'],
          columns: [],
          orderby: '',
        },
      ],
    },
    {
      id: 'slow-vs-fast',
      title: t('Slow vs. Fast Transactions'),
      description: t(
        'Percentage breakdown of transaction durations over and under 300ms.'
      ),
      displayType: DisplayType.BAR,
      widgetType: organization.features.includes('performance-discover-dataset-selector')
        ? WidgetType.TRANSACTIONS
        : WidgetType.DISCOVER,
      interval: '5m',
      queries: [
        {
          name: '',
          conditions: hasDatasetSelector(organization) ? '' : 'event.type:transaction',
          fields: [
            'equation|(count_if(transaction.duration,greater,300) / count()) * 100',
            'equation|(count_if(transaction.duration,lessOrEquals,300) / count()) * 100',
          ],
          aggregates: [
            'equation|(count_if(transaction.duration,greater,300) / count()) * 100',
            'equation|(count_if(transaction.duration,lessOrEquals,300) / count()) * 100',
          ],
          columns: [],
          orderby: '',
        },
      ],
    },
  ];
  const errorsWidgets = [
    {
      id: 'issue-for-review',
      title: t('Issues For Review'),
      description: t('Most recently seen unresolved issues for review.'),
      displayType: DisplayType.TABLE,
      widgetType: WidgetType.ISSUE,
      interval: '5m',
      queries: [
        {
          name: '',
          conditions: 'is:unresolved is:for_review',
          fields: ['issue', 'assignee', 'events', 'title'],
          aggregates: [],
          columns: ['issue', 'assignee', 'events', 'title'],
          orderby: 'date',
        },
      ],
    },
    {
      id: 'top-unhandled',
      title: t('Top Unhandled Error Types'),
      description: t('Most frequently encountered unhandled errors.'),
      displayType: DisplayType.TOP_N,
      widgetType: organization.features.includes('performance-discover-dataset-selector')
        ? WidgetType.ERRORS
        : WidgetType.DISCOVER,
      interval: '5m',
      queries: [
        {
          name: '',
          conditions: 'error.unhandled:true',
          fields: ['error.type', 'count()'],
          aggregates: ['count()'],
          columns: ['error.type'],
          orderby: '-count()',
        },
      ],
    },
    {
      id: 'users-affected',
      title: t('Users Affected by Errors'),
      description: t('Footprint of unique users affected by errors.'),
      displayType: DisplayType.LINE,
      widgetType: organization.features.includes('performance-discover-dataset-selector')
        ? WidgetType.ERRORS
        : WidgetType.DISCOVER,
      interval: '5m',
      queries: [
        {
          name: '',
          conditions: hasDatasetSelector(organization) ? '' : 'event.type:error',
          fields: ['count_unique(user)', 'count()'],
          aggregates: ['count_unique(user)', 'count()'],
          columns: [],
          orderby: '',
        },
      ],
    },
  ];
  return isSelfHostedErrorsOnly
    ? errorsWidgets
    : [...transactionsWidgets, ...errorsWidgets];
};

export function getTopNConvertedDefaultWidgets(
  organization: Organization
): readonly WidgetTemplate[] {
  return getDefaultWidgets(organization).map(widget => {
    if (widget.displayType === DisplayType.TOP_N) {
      return {
        ...widget,
        displayType: DisplayType.AREA,
        limit: TOP_N,
      };
    }
    return widget;
  });
}
