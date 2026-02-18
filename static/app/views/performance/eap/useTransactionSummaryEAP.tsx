import useOrganization from 'sentry/utils/useOrganization';

/**
 * Determines whether we should render the new EAP-based Transaction Summary Page.
 */
export const useTransactionSummaryEAP = (): boolean => {
  const organization = useOrganization();

  return organization.features.includes('performance-transaction-summary-eap');
};
