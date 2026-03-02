import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';

import SeerWizardSetupBanner from 'getsentry/views/seerAutomation/components/seerWizardSetupBanner';
import SettingsPageTabs from 'getsentry/views/seerAutomation/components/settingsPageTabs';
import useCanWriteSettings from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

interface Props {
  children: React.ReactNode;
}

export default function SeerSettingsPageContent({children}: Props) {
  const canWrite = useCanWriteSettings();

  return (
    <Stack gap="lg">
      <SeerWizardSetupBanner />

      <SettingsPageTabs />

      {canWrite ? null : (
        <Alert data-test-id="org-permission-alert" variant="warning">
          {t(
            'These settings can only be edited by users with the organization owner or manager role.'
          )}
        </Alert>
      )}

      {children}
    </Stack>
  );
}
