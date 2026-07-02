import {FieldGroup} from '@sentry/scraps/form';
import {Link} from '@sentry/scraps/link';

import {t, tct} from 'sentry/locale';
import type {DetailedProject} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';

import SpikeProtectionProjectToggle from 'getsentry/views/spikeProtection/spikeProtectionProjectToggle';

interface SpikeProtectionProjectSettingsProps {
  project: DetailedProject;
}

export function SpikeProtectionProjectSettings({
  project,
}: SpikeProtectionProjectSettingsProps) {
  const organization = useOrganization();
  const helpText = tct(
    'Enables automated rate limits for errors when a spike is detected for this project. [link]',
    {
      link: (
        <Link to={`/settings/${organization?.slug}/spike-protection/`}>
          {t('See all projects with spike protection.')}
        </Link>
      ),
    }
  );

  return (
    <FieldGroup title={t('Spike Protection')}>
      <SpikeProtectionProjectToggle
        project={project}
        label={t('Spike Protection')}
        help={helpText}
        analyticsView="project_settings"
        disabled={!project.access.includes('project:write')}
      />
    </FieldGroup>
  );
}
