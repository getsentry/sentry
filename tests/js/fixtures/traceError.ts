import {TraceError} from 'sentry/utils/performance/quickTrace/types';

export function TraceErrorFixture(params: Partial<TraceError> = {}): TraceError {
  return {
    event_id: '08384ee83c9145e79b5f6fbed5c37a51',
    issue_id: 62,
    span: 'bdf1a9fae2062311',
    project_id: 8,
    project_slug: 'santry',
    title: 'Error: Something went wrong',
    message: 'Something went wrong',
    level: 'error',
    issue: '',
    ...params,
  };
}
