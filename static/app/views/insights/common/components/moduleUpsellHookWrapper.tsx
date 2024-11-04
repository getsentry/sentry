import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import useOrganization from 'sentry/utils/useOrganization';
import {
  type TitleableModuleNames,
  UpsellPageHook,
} from 'sentry/views/insights/common/components/modulePageProviders';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {MODULE_FEATURE_MAP} from 'sentry/views/insights/settings';

// TODO - remove, This is only necessary for domain views, where we don't want to show the full upsell page.
export function ModuleBodyUpsellHook({
  moduleName,
  children,
}: {
  children: React.ReactNode;
  moduleName: TitleableModuleNames;
}) {
  const {isInDomainView: shouldDisplayUpsell} = useDomainViewFilters();
  const organization = useOrganization();

  if (shouldDisplayUpsell) {
    return (
      <UpsellPageHook moduleName={moduleName}>
        <Feature
          features={MODULE_FEATURE_MAP[moduleName]}
          organization={organization}
          renderDisabled={NoAccess}
        >
          {children}
        </Feature>
      </UpsellPageHook>
    );
  }
  return children;
}
