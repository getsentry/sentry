import {Fragment} from 'react';

import {t} from 'sentry/locale';
import {useKnownAgents} from 'sentry/utils/seer/preferredAgent';
import type {SeerProjectSettingResponse} from 'sentry/utils/seer/types';

/**
 * Render a known agent to their human-readable names.
 *
 * If the integrationId is not found, return the agent name and the integrationId as a fallback.
 */
export function PreferredAgentLabel({settings}: {settings: SeerProjectSettingResponse}) {
  const integrations = useKnownAgents();
  return (
    <Fragment>
      {settings.agent === 'seer'
        ? t('Seer Agent')
        : (integrations.find(i => i.id === settings.integrationId)?.name ??
          `${settings.agent} - ${settings.integrationId}`)}
    </Fragment>
  );
}
