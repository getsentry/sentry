import useOrganization from 'sentry/utils/useOrganization';

export function useHasIssueViews() {
  const organization = useOrganization();
  return organization.features.includes('issue-views');
}
