import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';

import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

interface UpdateSlackAlertProps {
  num_configurations: number;
}

export function UpdateSlackAlert({num_configurations}: UpdateSlackAlertProps) {
  const organization = useOrganization();

  // Dismiss for the current session so the alert doesn't reappear on every
  // remount (popping out to picture-in-picture, reopening the drawer), but it
  // still nudges the user again in a new session if they haven't updated.
  const [isDismissed, setIsDismissed] = useSessionStorage(
    `seer-explorer-update-slack-alert-dismissed:${organization.slug}`,
    false
  );

  if (isDismissed) {
    return null;
  }

  // Open the Slack integration's configurations tab, auto-opening the reinstall
  // modal when there's exactly one workspace (mirrors integrationRow.tsx). Use
  // `to` (not `href`) so navigation works from the popped-out PiP window too.
  const to =
    `/settings/${organization.slug}/integrations/slack/?tab=configurations&referrer=seer_explorer_update_slack` +
    (num_configurations === 1 ? '&showInstallModal=1' : '');

  return (
    <Container padding="lg">
      <Alert
        variant="muted"
        trailingItems={
          <Flex gap="sm" alignSelf="center">
            <LinkButton
              to={to}
              variant="primary"
              size="xs"
              onClick={() => {
                trackAnalytics('seer.explorer.update_slack_clicked', {
                  organization,
                  num_configurations,
                });
                setIsDismissed(true);
              }}
            >
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
          'Chat, ask questions, and debug with Sentry in the new Slack app. Please reinstall the Slack app to get started.'
        )}
      </Alert>
    </Container>
  );
}
