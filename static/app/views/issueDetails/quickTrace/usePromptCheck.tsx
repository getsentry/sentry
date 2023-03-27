import {useCallback, useEffect, useState} from 'react';

import {promptsCheck, promptsUpdate} from 'sentry/actionCreators/prompts';
import {Organization} from 'sentry/types';
import {promptIsDismissed} from 'sentry/utils/promptIsDismissed';
import useApi from 'sentry/utils/useApi';

type Opts = {
  feature: string;
  organization: Organization;
  projectId: string;
};

function usePromptCheck({feature, organization, projectId}: Opts) {
  const api = useApi();

  const [shouldShowPrompt, setShouldShow] = useState<boolean | null>(null);

  useEffect(() => {
    promptsCheck(api, {
      organizationId: organization.id,
      projectId,
      feature,
    }).then(data => {
      setShouldShow(!promptIsDismissed(data ?? {}, 30));
    });
  }, [api, feature, organization, projectId]);

  const snoozePrompt = useCallback(async () => {
    const data = {
      projectId,
      organizationId: organization.id,
      feature,
      status: 'snoozed' as const,
    };
    await promptsUpdate(api, data);
    setShouldShow(false);
  }, [api, feature, organization, projectId]);

  return {
    shouldShowPrompt,
    snoozePrompt,
  };
}

export default usePromptCheck;
