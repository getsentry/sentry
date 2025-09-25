import {useState} from 'react';
import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import {DebugNotificationsPreview} from 'sentry/debug/notifications/components/debugNotificationsPreview';
import {
  NotificationProviderKey,
  type NotificationTemplateRegistration,
} from 'sentry/debug/notifications/types';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';

export function TeamsPreview({
  registration,
}: {
  registration: NotificationTemplateRegistration;
}) {
  const [showJson, setShowJson] = useState(false);
  const card = registration.previews[NotificationProviderKey.TEAMS];

  return (
    <DebugNotificationsPreview title="MS Teams">
      <div>
        {t('Copy the JSON below into the')}
        <ExternalLink href="https://adaptivecards.microsoft.com/designer.html">
          {t(' MSTeams Previewer')}
        </ExternalLink>
      </div>
      <ToggleButton
        size="xs"
        onClick={() => setShowJson(!showJson)}
        priority="default"
        icon={<IconChevron direction={showJson ? 'up' : 'down'} />}
      >
        {showJson ? 'Hide JSON' : 'Show JSON'}
      </ToggleButton>
      {showJson && (
        <StyledCodeSnippet language="json">
          {JSON.stringify(card, null, 2)}
        </StyledCodeSnippet>
      )}
    </DebugNotificationsPreview>
  );
}

const ToggleButton = styled(Button)`
  margin-top: ${p => p.theme.space.sm};
  margin-bottom: ${p => p.theme.space.sm};
`;

const StyledCodeSnippet = styled(CodeSnippet)`
  margin-top: ${p => p.theme.space.md};
  margin-bottom: ${p => p.theme.space.md};
`;
