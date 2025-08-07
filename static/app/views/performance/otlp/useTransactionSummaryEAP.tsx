import useOrganization from 'sentry/utils/useOrganization';

/**
 * Determines whether we should render the new EAP-based Transaction Summary Page. The EAP-based Transaction Summary page is also naturally OTel-friendly.
 */
export const useTransactionSummaryEAP = (): boolean => {
  const organization = useOrganization();

  return organization.features.includes('performance-transaction-summary-eap');
};
