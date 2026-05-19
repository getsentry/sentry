/**
 * Determines whether we should render the new EAP-based Transaction Summary Page.
 *
 * The flag this used to gate (`performance-transaction-summary-eap`) was at
 * 100% rollout and has been removed. The hook is kept for now so callers can
 * be cleaned up incrementally — it always returns true.
 */
export const useTransactionSummaryEAP = (): boolean => {
  return true;
};
