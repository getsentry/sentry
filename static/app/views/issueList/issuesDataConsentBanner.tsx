import {useContext} from 'react';

import HookOrDefault from 'sentry/components/hookOrDefault';
import {NewTabContext} from 'sentry/views/issueList/utils/newTabContext';

export function IssuesDataConsentBanner({source}: {source: string}) {
  const DataConsentBanner = HookOrDefault({
    hookName: 'component:data-consent-banner',
    defaultComponent: null,
  });

  const {newViewActive} = useContext(NewTabContext);

  return newViewActive ? null : <DataConsentBanner source={source} />;
}
