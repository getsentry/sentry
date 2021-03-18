import {t} from 'app/locale';

export type AlertType =
  | 'issues'
  | 'num_errors'
  | 'users_experiencing_errors'
  | 'throughput'
  | 'trans_duration'
  | 'lcp';

export const options: Record<string, [AlertType, string][]> = {
  [t('Errors')]: [
    ['issues', t('Issues')],
    ['num_errors', t('Number of Errors')],
    ['users_experiencing_errors', t('Users Experiencing Errors')],
  ],
  [t('Performance')]: [
    ['throughput', t('Throughput')],
    ['trans_duration', t('Transaction Duration')],
    ['lcp', t('Longest Contentful Paint')],
  ],
};

// TODO(davidenwang): Once the copy is finalized for the wizard fill this in with real content
export const descriptions: Record<AlertType, string> = {
  issues: t('An issue alert allows you to alert on a group of error events in Sentry'),
  num_errors: t('Alert on the number of errors coming into your Sentry dashboard'),
  users_experiencing_errors: t('Alert on the number of users experiencing errors'),
  throughput: t('Alert on the number of transactions happening in your application'),
  trans_duration: t('Alert on the duration of transactions'),
  lcp: t('Alert on longest contentful paint'),
};
