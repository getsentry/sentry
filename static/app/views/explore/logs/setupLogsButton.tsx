import {LinkButton} from '@sentry/scraps/button';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {withoutLoggingSupport} from 'sentry/data/platformCategories';
import {platforms} from 'sentry/data/platforms';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

export function SetupLogsButton() {
  const organization = useOrganization();
  const projects = useProjects();
  const pageFilters = usePageFilters();
  let project = projects.projects?.[0];

  const filtered = projects.projects?.filter(p =>
    pageFilters.selection.projects.includes(parseInt(p.id, 10))
  );
  if (filtered && filtered.length > 0) {
    project = filtered[0];
  }

  const currentPlatform = project?.platform
    ? platforms.find(p => p.id === project.platform)
    : undefined;

  const doesNotSupportLogging = currentPlatform
    ? withoutLoggingSupport.has(currentPlatform.id)
    : false;

  return (
    <LinkButton
      icon={<IconOpen />}
      priority="primary"
      href="https://docs.sentry.io/product/explore/logs/getting-started/"
      external
      onClick={() => {
        trackAnalytics('logs.explorer.setup_button_clicked', {
          organization,
          platform: currentPlatform?.id ?? 'unknown',
          supports_onboarding_checklist: !doesNotSupportLogging,
        });
      }}
    >
      {t('Set Up Logs')}
    </LinkButton>
  );
}
