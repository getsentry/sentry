import {Fragment} from 'react';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {decodeScalar} from 'sentry/utils/queryString';
import {hasTempestAccess} from 'sentry/utils/tempest/features';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {useHasTempestWriteAccess} from 'sentry/views/settings/project/tempest/utils/access';

import DevKitSettings, {getDevKitHeaderAction} from './DevKitSettings';
import PlayStationSettings, {getPlayStationHeaderAction} from './PlayStationSettings';

interface Props {
  organization: Organization;
  project: Project;
}

type Tab = 'playstation' | 'devkit-crashes';

const TAB_LABELS: Record<Tab, string> = {
  playstation: t('Retail'),
  'devkit-crashes': t('DevKit'),
};

const PS5_WARNING_DISMISS_KEY = 'tempest-ps5-warning-dismissed';

export default function TempestSettings({organization, project}: Props) {
  const hasWriteAccess = useHasTempestWriteAccess();
  const location = useLocation();
  const navigate = useNavigate();
  const {dismiss: dismissPS5Warning, isDismissed: isPS5WarningDismissed} =
    useDismissAlert({
      key: PS5_WARNING_DISMISS_KEY,
    });

  const getCurrentTab = (): Tab => {
    const queryTab = decodeScalar(location?.query?.tab);
    return (
      ['playstation', 'devkit-crashes'].includes(queryTab || '')
        ? queryTab
        : 'playstation'
    ) as Tab;
  };

  const tab = getCurrentTab();

  const handleTabChange = (newTab: Tab) => {
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        tab: newTab,
      },
    });
  };

  if (!hasTempestAccess(organization)) {
    return (
      <Alert.Container>
        <Alert type="warning" showIcon={false}>
          {t("You don't have access to this feature")}
        </Alert>
      </Alert.Container>
    );
  }

  const renderPlayStationSettings = () => {
    return <PlayStationSettings organization={organization} project={project} />;
  };

  const renderDevKitCrashesSettings = () => {
    return <DevKitSettings organization={organization} project={project} />;
  };

  const renderTabContent = () => {
    switch (tab) {
      case 'playstation':
        return renderPlayStationSettings();
      case 'devkit-crashes':
        return renderDevKitCrashesSettings();
      default:
        return renderPlayStationSettings();
    }
  };

  const getPageTitle = () => {
    switch (tab) {
      case 'devkit-crashes':
        return t('DevKit Crashes');
      case 'playstation':
      default:
        return t('PlayStation');
    }
  };

  const getHeaderAction = () => {
    switch (tab) {
      case 'devkit-crashes':
        return getDevKitHeaderAction(organization, project);
      case 'playstation':
      default:
        return getPlayStationHeaderAction(hasWriteAccess, organization, project);
    }
  };

  return (
    <Fragment>
      <SentryDocumentTitle title={getPageTitle()} />
      <SettingsPageHeader title={getPageTitle()} action={getHeaderAction()} />

      {!isPS5WarningDismissed && (
        <div>
          <Alert.Container>
            <Alert
              type="warning"
              trailingItems={
                <Button
                  priority="link"
                  icon={<IconClose />}
                  onClick={dismissPS5Warning}
                  aria-label={t('Dismiss Alert')}
                  title={t('Dismiss Alert')}
                  size="zero"
                  borderless
                />
              }
            >
              {t(
                `Currently Sentry only supports PlayStation 5. If you're looking for PS4 support, please let us know!`
              )}
            </Alert>
          </Alert.Container>
        </div>
      )}

      <div style={{marginBottom: '1rem'}}>
        <Tabs value={tab} onChange={handleTabChange}>
          <TabList>
            {Object.entries(TAB_LABELS).map(([key, label]) => (
              <TabList.Item key={key}>{label}</TabList.Item>
            ))}
          </TabList>
        </Tabs>
      </div>

      {renderTabContent()}
    </Fragment>
  );
}
