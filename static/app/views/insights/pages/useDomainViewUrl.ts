export function useModuleURLBuilder(
  bare: boolean = false,
  autoDetectDomainView: boolean = true,
  forceDomainView?: boolean // TODO - eventually this param will be removed once we don't have modules in two spots
): URLBuilder {
  const organization = useOrganization({allowNull: true}); // Some parts of the app, like the main sidebar, render even if the organization isn't available (during loading, or at all).
  const {isInDomainView, view: currentView} = useDomainViewFilters();

  if (!organization) {
    // If there isn't an organization, items that link to modules won't be visible, so this is a fallback just-in-case, and isn't trying too hard to be useful
    return () => '';
  }

  const {slug} = organization;

  if ((autoDetectDomainView && isInDomainView) || forceDomainView) {
    return function (moduleName: RoutableModuleNames, domainView?: DomainView) {
      const view = domainView ?? currentView;
      return bare
        ? `${DOMAIN_VIEW_BASE_URL}/${view}/${MODULE_BASE_URLS[moduleName]}`
        : normalizeUrl(
            `/organizations/${slug}/${DOMAIN_VIEW_BASE_URL}/${view}/${MODULE_BASE_URLS[moduleName]}`
          );
    };
  }

  return function (moduleName: RoutableModuleNames) {
    return bare
      ? `${INSIGHTS_BASE_URL}/${MODULE_BASE_URLS[moduleName]}`
      : normalizeUrl(
          `/organizations/${slug}/${INSIGHTS_BASE_URL}/${MODULE_BASE_URLS[moduleName]}`
        );
  };
}
