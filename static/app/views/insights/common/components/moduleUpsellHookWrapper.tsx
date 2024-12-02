import HookOrDefault from 'sentry/components/hookOrDefault';
import type {TitleableModuleNames} from 'sentry/views/insights/common/components/modulePageProviders';

// TODO - remove, This is only necessary for domain views, where we don't want to show the full upsell page.
export function ModuleBodyUpsellHook({
  moduleName,
  children,
}: {
  children: React.ReactNode;
  moduleName: TitleableModuleNames;
}) {
  return (
    <UpsellPageHook moduleName={moduleName} fullPage={false}>
      {children}
    </UpsellPageHook>
  );
}

const UpsellPageHook = HookOrDefault({
  hookName: 'component:insights-upsell-page',
  defaultComponent: ({children}) => children,
});
