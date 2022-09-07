import React from 'react';
import capitalize from 'lodash/capitalize';

import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct, tn} from 'sentry/locale';
import {Organization} from 'sentry/types';

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
  return function (action: ConfirmAction | string, canBeUndone: boolean, append = '') {
    const question = allInQuerySelected
      ? getBulkConfirmMessage(`${action}${append}`, queryCount)
      : tn(
          `Are you sure you want to ${action} this %s issue${append}?`,
          `Are you sure you want to ${action} these %s issues${append}?`,
          numIssues
        );

    let message;
    switch (action) {
      case ConfirmAction.DELETE:
        message = (
          <React.Fragment>
            {query && organization.features.includes('performance-issues') && (
              <p>
                {t(
                  'Deleting performance issues is not yet supported. You may want to modify your search query to exclude them if you encounter an error.'
                )}
              </p>
            )}
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
          </React.Fragment>
        );
        break;
      case ConfirmAction.MERGE:
        message = (
          <React.Fragment>
            {query && organization.features.includes('performance-issues') && (
              <p>
                {t(
                  'Merging performance issues is not yet supported. You may want to modify your search query to exclude them if you encounter an error.'
                )}
              </p>
            )}
            <p>{t('Note that unmerging is currently an experimental feature.')}</p>
          </React.Fragment>
        );
        break;
      default:
        message = <p>{t('This action cannot be undone.')}</p>;
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
        {!canBeUndone && message}
      </div>
    );
  };
}

export function getLabel(numIssues: number, allInQuerySelected: boolean) {
  return function (action: string, append = '') {
    const capitalized = capitalize(action);
    const text = allInQuerySelected
      ? t(`Bulk ${action} issues`)
      : tn(
          `${capitalized} %s selected issue`,
          `${capitalized} %s selected issues`,
          numIssues
        );

    return text + append;
  };
}
