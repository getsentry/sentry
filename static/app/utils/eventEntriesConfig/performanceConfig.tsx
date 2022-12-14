import {t} from 'sentry/locale';
import {IssueType} from 'sentry/types';
import {EventEntriesIssueTypeMapping} from 'sentry/utils/eventEntriesConfig/types';

const performanceConfig: EventEntriesIssueTypeMapping = {
  _default: {},
  [IssueType.PERFORMANCE_FILE_IO_MAIN_THREAD]: {
    evidence: {
      title: t('Span Evidence'),
      helpText: t('Span Evidence identifies the span where the file IO occurred.'),
    },
    resources: {
      description: t('File IO operations on your main thread may cause app hangs.'),
      links: [],
      linksByPlatform: {},
    },
  },
  [IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES]: {
    evidence: {
      title: t('Span Evidence'),
      helpText: t(
        'Span Evidence identifies the parent span where the N+1 occurs, and the repeating spans.'
      ),
    },
    resources: {
      description: t(
        "N+1 queries are extraneous queries (N) caused by a single, initial query (+1). In the Span Evidence above, we've identified the parent span where the extraneous spans are located and the extraneous spans themselves. To learn more about how to fix N+1 problems, check out these resources:"
      ),
      links: [
        {
          text: t('Sentry Docs: N+1 Queries'),
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/n-one-queries/',
        },
      ],
      linksByPlatform: {
        python: [
          {
            text: t('Finding and Fixing Django N+1 Problems'),
            link: 'https://blog.sentry.io/2020/09/14/finding-and-fixing-django-n-1-problems',
          },
        ],
        'python-django': [
          {
            text: t('Finding and Fixing Django N+1 Problems'),
            link: 'https://blog.sentry.io/2020/09/14/finding-and-fixing-django-n-1-problems',
          },
        ],
      },
    },
  },
};

export default performanceConfig;
