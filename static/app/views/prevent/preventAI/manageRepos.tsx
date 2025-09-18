import {usePreventAIConfig} from 'sentry/views/prevent/preventAI/hooks/usePreventAIConfig';
import {useUpdatePreventAIFeature} from 'sentry/views/prevent/preventAI/hooks/useUpdatePreventAIFeature';
import {FeatureOverview} from 'sentry/views/prevent/preventAI/onboarding';
import type {PreventAIOrg} from 'sentry/views/prevent/preventAI/types';

function PreventAIManageRepos({installedOrgs}: {installedOrgs: PreventAIOrg[]}) {
  // TODO: remove these 2 temporary calls to the dummy hooks (put here to appease knip)
  usePreventAIConfig();
  useUpdatePreventAIFeature();

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
