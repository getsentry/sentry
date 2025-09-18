import type {PreventAIOrg} from 'sentry/views/prevent/preventAI/types';

function PreventAIManageRepos({installedOrgs}: {installedOrgs: PreventAIOrg[]}) {
  return (
    <div>
      PreventAIManageRepos placeholder, countInstalledOrgs: {installedOrgs.length}
    </div>
  );
}

export default PreventAIManageRepos;
