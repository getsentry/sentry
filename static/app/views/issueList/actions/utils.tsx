import {Fragment} from 'react';

import {Alert} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct, tn} from 'sentry/locale';
import {capitalize} from 'sentry/utils/string/capitalize';
import commonTheme from 'sentry/utils/theme';

import ExtraDescription from './extraDescription';

export const BULK_LIMIT = 1000;
export const BULK_LIMIT_STR = BULK_LIMIT.toLocaleString();

export enum ConfirmAction {
  RESOLVE = 'resolve',
  UNRESOLVE = 'unresolve',
  ARCHIVE = 'archive',
  BOOKMARK = 'bookmark',
  UNBOOKMARK = 'unbookmark',
  MERGE = 'merge',
  DELETE = 'delete',
  SET_PRIORITY = 'reprioritize',
}

function getBulkConfirmMessage(action: string, queryCount: number) {
  if (queryCount > BULK_LIMIT) {
    return tct(
      'Are you sure you want to [action] the first [bulkNumber] issues that match the search?',
      {
        action,
        bulkNumber: BULK_LIMIT_STR,
      }
    );
  }

  return tct(
    'Are you sure you want to [action] all [bulkNumber] issues that match the search?',
    {
      action,
      bulkNumber: queryCount,
    }
  );
}

function PerformanceIssueAlert({
  allInQuerySelected,
  children,
}: {
  allInQuerySelected: boolean;
  children: string;
}) {
  if (!allInQuerySelected) {
    return null;
  }

  return (
    <Alert type="info" showIcon>
      {children}
    </Alert>
  );
}

export function getConfirm({
  numIssues,
  allInQuerySelected,
  query,
  queryCount,
}: {
  allInQuerySelected: boolean;
  numIssues: number;
  query: string;
  queryCount: number;
}) {
  return function ({
    action,
    canBeUndone,
    append = '',
  }: {
    action: ConfirmAction;
    canBeUndone: boolean;
    append?: string;
  }) {
    const question = allInQuerySelected
      ? getBulkConfirmMessage(`${action}${append}`, queryCount)
      : tn(
          // Use sprintf argument swapping since the number value must come
          // first. See https://github.com/alexei/sprintf.js#argument-swapping
          `Are you sure you want to %2$s this %s issue%3$s?`,
          `Are you sure you want to %2$s these %s issues%3$s?`,
          numIssues,
          action,
          append
        );

    let message: React.ReactNode;
    switch (action) {
      case ConfirmAction.DELETE:
        message = (
          <Fragment>
            <p>
              {tct(
                'Bulk deletion is only recommended for junk data. To clear your stream, consider resolving or ignoring. [link:When should I delete events?]',
                {
                  link: (
                    <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/23813143627675-When-should-I-delete-events" />
                  ),
                }
              )}
            </p>
            <PerformanceIssueAlert allInQuerySelected={allInQuerySelected}>
              {t('Deleting performance issues is not yet supported and will be skipped.')}
            </PerformanceIssueAlert>
          </Fragment>
        );
        break;
      case ConfirmAction.MERGE:
        message = (
          <Fragment>
            <p>{t('Note that unmerging is currently an experimental feature.')}</p>
            <PerformanceIssueAlert allInQuerySelected={allInQuerySelected}>
              {t('Merging performance issues is not yet supported and will be skipped.')}
            </PerformanceIssueAlert>
          </Fragment>
        );
        break;
      default:
        message = !canBeUndone ? <p>{t('This action cannot be undone.')}</p> : null;
    }

    return (
      <div>
        <p style={{marginBottom: '20px'}}>
          <strong>{question}</strong>
        </p>
        <ExtraDescription
          all={allInQuerySelected}
          query={query}
          queryCount={queryCount}
        />
        {message}
      </div>
    );
  };
}

export function getLabel(numIssues: number, allInQuerySelected: boolean) {
  return function (action: string, append = '') {
    const capitalized = capitalize(action);
    const text = allInQuerySelected
      ? t('Bulk %s issues', action)
      : // Use sprintf argument swapping to put the capitalized string first. See
        // https://github.com/alexei/sprintf.js#argument-swapping
        tn(`%2$s %s selected issue`, `%2$s %s selected issues`, numIssues, capitalized);

    return text + append;
  };
}

// A mapping of which screen sizes will trigger the column to disappear
// e.g. 'Trend': screen.small => 'Trend' column will disappear on screen.small widths
export const COLUMN_BREAKPOINTS = {
  ISSUE: undefined, // Issue column is always visible
  TREND: commonTheme.breakpoints.small,
  AGE: commonTheme.breakpoints.xlarge,
  SEEN: commonTheme.breakpoints.xlarge,
  EVENTS: commonTheme.breakpoints.medium,
  USERS: commonTheme.breakpoints.medium,
  PRIORITY: commonTheme.breakpoints.large,
  ASSIGNEE: commonTheme.breakpoints.xsmall,
};
