import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';

const DataConsentBanner = OverrideOrDefault({
  overrideName: 'component:data-consent-banner',
  defaultComponent: null,
});

export function IssuesDataConsentBanner({source}: {source: string}) {
  return <DataConsentBanner source={source} />;
}
