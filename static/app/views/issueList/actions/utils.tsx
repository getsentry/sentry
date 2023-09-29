import {Fragment} from 'react';
import capitalize from 'lodash/capitalize';

import {Alert} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct, tn} from 'sentry/locale';
import {IgnoredStatusDetails, Organization} from 'sentry/types';

import ExtraDescription from './extraDescription';

export const BULK_LIMIT = 1000;
export const BULK_LIMIT_STR = BULK_LIMIT.toLocaleString();

export enum ConfirmAction {
  RESOLVE = 'resolve',
  UNRESOLVE = 'unresolve',
  IGNORE = 'ignore',
  BOOKMARK = 'bookmark',
  UNBOOKMARK = 'unbookmark',
  MERGE = 'merge',
  DELETE = 'delete',
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
  organization,
}: {
  allInQuerySelected: boolean;
  numIssues: number;
  organization: Organization;
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
    const actionText =
      action === ConfirmAction.IGNORE &&
      organization.features.includes('escalating-issues')
        ? t('archive')
        : action;
    const question = allInQuerySelected
      ? getBulkConfirmMessage(`${actionText}${append}`, queryCount)
      : tn(
          // Use sprintf argument swapping since the number value must come
          // first. See https://github.com/alexei/sprintf.js#argument-swapping
          `Are you sure you want to %2$s this %s issue%3$s?`,
          `Are you sure you want to %2$s these %s issues%3$s?`,
          numIssues,
          actionText,
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
                    <ExternalLink href="https://help.sentry.io/account/billing/when-should-i-delete-events/" />
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

export function performanceIssuesSupportsIgnoreAction(
  statusDetails: IgnoredStatusDetails
) {
  return !(statusDetails.ignoreWindow || statusDetails.ignoreUserWindow);
}
