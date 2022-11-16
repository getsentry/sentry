import {useCallback, useEffect, useState} from 'react';

import {promptsCheck, promptsUpdate} from 'sentry/actionCreators/prompts';
import {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {promptIsDismissed} from 'sentry/utils/promptIsDismissed';
import useApi from 'sentry/utils/useApi';

type Opts = {
  event: Event;
  feature: string;
  organization: Organization;
};

function usePromptCheck({event, feature, organization}: Opts) {
  const api = useApi();

  const [shouldShowPrompt, setShouldShow] = useState<boolean | null>(null);

  useEffect(() => {
    promptsCheck(api, {
      organizationId: organization.id,
      projectId: event.projectID,
      feature,
    }).then(data => {
      setShouldShow(!promptIsDismissed(data ?? {}, 30));
    });
  }, [api, event, feature, organization]);

  const snoozePrompt = useCallback(async () => {
    const data = {
      projectId: event.projectID,
      organizationId: organization.id,
      feature,
      status: 'snoozed' as const,
    };
    await promptsUpdate(api, data);
    setShouldShow(false);
  }, [api, event, feature, organization]);

  return {
    shouldShowPrompt,
    snoozePrompt,
  };
}

export default usePromptCheck;
