import {Fragment} from 'react';
import {IconClose} from '@sentry/icons/close';
import {parseAsBoolean, parseAsInteger, parseAsStringLiteral, useQueryStates} from 'nuqs';

import {Alert} from '@sentry/scraps/alert';
import {Flex} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';

import {RequestSdkAccessButton} from 'sentry/components/gameConsole/RequestSdkAccessButton';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {hasTempestAccess} from 'sentry/utils/tempest/features';
import {useDismissAlert} from 'sentry/utils/useDismissAlert';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import {DevKitSettings} from './DevKitSettings';
import {PlayStationSettings} from './PlayStationSettings';

const TABS = ['retail', 'devkit-crashes'] as const;

type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  retail: t('Retail'),
  'devkit-crashes': t('DevKit'),
};

const PS5_WARNING_DISMISS_KEY = 'tempest-ps5-warning-dismissed';

export default function TempestSettings() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const [{tab: tabParam}, setQueryParams] = useQueryStates({
    tab: parseAsStringLiteral(TABS),
    guidedStep: parseAsInteger,
    setupInstructions: parseAsBoolean,
  });
  const {dismiss: dismissPS5Warning, isDismissed: isPS5WarningDismissed} =
    useDismissAlert({
      key: PS5_WARNING_DISMISS_KEY,
    });

  const tab = tabParam ?? 'devkit-crashes';

  const handleTabChange = (newTab: Tab) => {
    setQueryParams(
      {
        tab: newTab,
        // Reset guided step when switching tabs to avoid cross-tab bleed
        guidedStep: null,
        // setupInstructions is only available on the retail tab
        setupInstructions: null,
      },
      {history: 'push'}
    );
  };

  if (!hasTempestAccess(organization)) {
    return (
      <Alert.Container>
        <Alert variant="warning" showIcon={false}>
          {t("You don't have access to this feature")}
        </Alert>
      </Alert.Container>
    );
  }

  const getPageTitle = () => {
    switch (tab) {
      case 'devkit-crashes':
        return t('DevKit Crashes');
      case 'retail':
      default:
        return t('Retail');
    }
  };

  return (
    <Fragment>
      <SentryDocumentTitle title={getPageTitle()} />
      <SettingsPageHeader title={getPageTitle()} />

      {!isPS5WarningDismissed && (
        <div>
          <Alert.Container>
            <Alert
              variant="warning"
              trailingItems={
                <Alert.Button
                  variant="transparent"
                  icon={<IconClose />}
                  onClick={dismissPS5Warning}
                  aria-label={t('Dismiss Alert')}
                  tooltipProps={{title: t('Dismiss Alert')}}
                />
              }
            >
              {t(
                "Currently Sentry only supports PlayStation 5. If you're looking for PS4 support, please let us know!"
              )}
            </Alert>
          </Alert.Container>
        </div>
      )}

      <Flex align="center" justify="between" style={{marginBottom: '1rem'}}>
        <Tabs value={tab} onChange={handleTabChange}>
          <TabList>
            {Object.entries(TAB_LABELS).map(([key, label]) => (
              <TabList.Item key={key}>{label}</TabList.Item>
            ))}
          </TabList>
        </Tabs>
        <RequestSdkAccessButton
          gamingPlatform="playstation"
          organization={organization}
          projectId={project.id}
          origin="project-settings"
        />
      </Flex>

      {tab === 'devkit-crashes' ? (
        <DevKitSettings organization={organization} project={project} />
      ) : (
        <PlayStationSettings organization={organization} project={project} />
      )}
    </Fragment>
  );
}
