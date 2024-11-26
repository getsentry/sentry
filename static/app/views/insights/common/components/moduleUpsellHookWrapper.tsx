import Feature from 'sentry/components/acl/feature';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {NoAccess} from 'sentry/components/noAccess';
import useOrganization from 'sentry/utils/useOrganization';
import type {TitleableModuleNames} from 'sentry/views/insights/common/components/modulePageProviders';
import {MODULE_FEATURE_MAP} from 'sentry/views/insights/settings';

// TODO - remove, This is only necessary for domain views, where we don't want to show the full upsell page.
export function ModuleBodyUpsellHook({
  moduleName,
  children,
}: {
  children: React.ReactNode;
  moduleName: TitleableModuleNames;
}) {
  const organization = useOrganization();

  return (
    <UpsellPageHook moduleName={moduleName} fullPage={false}>
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

const UpsellPageHook = HookOrDefault({
  hookName: 'component:insights-upsell-page',
  defaultComponent: ({children}) => children,
});
