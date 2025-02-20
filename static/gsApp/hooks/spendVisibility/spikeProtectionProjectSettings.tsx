import Link from 'sentry/components/links/link';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';

import SpikeProtectionProjectToggle from 'getsentry/views/spikeProtection/spikeProtectionProjectToggle';

interface SpikeProtectionProjectSettingsProps {
  project: Project;
}

function SpikeProtectionProjectSettings({project}: SpikeProtectionProjectSettingsProps) {
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
    <Panel>
      <PanelHeader>{t('Spike Protection')}</PanelHeader>
      <PanelBody>
        <SpikeProtectionProjectToggle
          project={project}
          label={t('Spike Protection')}
          help={helpText}
          analyticsView="project_settings"
          disabled={!project.access.includes('project:write')}
        />
      </PanelBody>
    </Panel>
  );
}

export default SpikeProtectionProjectSettings;
