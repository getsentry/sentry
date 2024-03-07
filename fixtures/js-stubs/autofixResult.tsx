import {AutofixResult} from 'sentry/components/events/autofix/types';

export function AutofixResultFixture(params: Partial<AutofixResult>): AutofixResult {
  return {
    title: 'Fixed the bug!',
    pr_number: 123,
    description: 'This is a description',
    pr_url: 'https://github.com/pulls/1234',
    repo_name: 'getsentry/sentry',
    ...params,
  };
}
