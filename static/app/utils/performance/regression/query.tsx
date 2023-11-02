import {MutableSearch} from 'sentry/utils/tokenizeSearch';

export function getTransactionQuery(transaction: string, extraFilters: string = '') {
  return new MutableSearch(
    `event.type:transaction transaction:"${transaction} ${extraFilters}"`.trim()
  ).formatString();
}
