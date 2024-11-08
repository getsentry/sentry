import {useContext} from 'react';

import HookOrDefault from 'sentry/components/hookOrDefault';
import {NewTabContext} from 'sentry/views/issueList/utils/newTabContext';

const DataConsentBanner = HookOrDefault({
  hookName: 'component:data-consent-banner',
  defaultComponent: null,
});

export function IssuesDataConsentBanner({source}: {source: string}) {
  const {newViewActive} = useContext(NewTabContext);

  return newViewActive ? null : <DataConsentBanner source={source} />;
}
