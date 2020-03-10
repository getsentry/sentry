export function generateTransactionSummaryRoute({orgSlug}: {orgSlug: String}): string {
  return `/organizations/${orgSlug}/performance/summary/`;
}

export function transactionSummaryRouteWithEventView({
  orgSlug,
  projectID,
  transaction,
}: {
  orgSlug: string;
  projectID: string | undefined;
  transaction: string;
}) {
  const pathname = generateTransactionSummaryRoute({
    orgSlug,
  });

  const query = {
    project: projectID,
    transaction,
  };

  return {
    pathname,
    query,
  };
}
