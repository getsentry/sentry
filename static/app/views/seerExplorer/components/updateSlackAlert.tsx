import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';

import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

interface UpdateSlackAlertProps {
  configurations: number;
}

export function UpdateSlackAlert({configurations}: UpdateSlackAlertProps) {
  const organization = useOrganization();

  // Dismiss for the current session so the alert doesn't reappear on every
  // remount (popping out to picture-in-picture, reopening the drawer), but it
  // still nudges the user again in a new session if they haven't updated.
  const [isDismissed, setIsDismissed] = useSessionStorage(
    'seer-explorer-update-slack-alert-dismissed',
    false
  );

  if (isDismissed) {
    return null;
  }

  // Mirrors the "Resolve Now" link from the integration directory
  // (see integrationRow.tsx): open the Slack integration's configurations tab,
  // auto-opening the reinstall modal when there's exactly one workspace.
  const href =
    `/settings/${organization.slug}/integrations/slack/?tab=configurations&referrer=seer_explorer_update_slack` +
    (configurations === 1 ? '&showInstallModal=1' : '');

  return (
    <Container padding="lg">
      <Alert
        variant="muted"
        trailingItems={
          <Flex gap="sm" alignSelf="center">
            <LinkButton href={href} variant="primary" size="xs">
              {t('Update Now')}
            </LinkButton>
            <Button
              icon={<IconClose />}
              variant="transparent"
              size="xs"
              aria-label={t('Dismiss')}
              onClick={() => setIsDismissed(true)}
            />
          </Flex>
        }
      >
        {t(
          'Chat, ask questions, and debug with Sentry in the new Slack app. Please reinstall the slack app to get started.'
        )}
      </Alert>
    </Container>
  );
}
