import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import type {Team} from 'sentry/types/organization';

interface TeamAdminProjectCreationAlertProps {
  /**
   * The teams the member administers, where they can still create projects.
   */
  teams: Team[];
  /**
   * Shows a "Set up manually" button that switches to the manual form.
   */
  onSetupInBrowser?: () => void;
}

export function TeamAdminProjectCreationAlert({
  teams,
  onSetupInBrowser,
}: TeamAdminProjectCreationAlertProps) {
  return (
    <Alert
      variant="warning"
      showIcon
      trailingItems={
        onSetupInBrowser ? (
          <Button size="xs" onClick={onSetupInBrowser}>
            {t('Set up manually')}
          </Button>
        ) : undefined
      }
    >
      {t(
        'Your organization only lets members create projects on teams they administer: %s. Tell your agent to use one of these teams, or ask an owner or manager to create the project for you.',
        teams.map(team => `#${team.slug}`).join(', ')
      )}
    </Alert>
  );
}
