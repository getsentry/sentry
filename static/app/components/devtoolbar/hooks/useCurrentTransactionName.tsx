import * as Sentry from '@sentry/react';

export default function useCurrentTransactionName() {
  const scope = Sentry.getCurrentScope();
  const scopeData = scope.getScopeData();
  const transactionName = `/${scopeData.transactionName}/`.replaceAll('//', '/');
  return transactionName;
}
