import type {PreventAIOrg} from 'sentry/views/prevent/preventAI/types';

import FeatureOverview from './onboarding';

function PreventAIManageRepos({installedOrgs}: {installedOrgs: PreventAIOrg[]}) {
  return (
    <div>
      <div style={{paddingBottom: '16px'}}>
        PreventAIManageRepos placeholder, countInstalledOrgs: {installedOrgs.length}
      </div>
      <FeatureOverview />
    </div>
  );
}

export default PreventAIManageRepos;
