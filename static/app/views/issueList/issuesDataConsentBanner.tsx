import HookOrDefault from 'sentry/components/hookOrDefault';

const DataConsentBanner = HookOrDefault({
  hookName: 'component:data-consent-banner',
  defaultComponent: null,
});

export function IssuesDataConsentBanner({source}: {source: string}) {
  return <DataConsentBanner source={source} />;
}
