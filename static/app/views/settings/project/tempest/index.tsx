import {Fragment} from 'react';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import {RequestSdkAccessButton} from 'sentry/components/gameConsole/RequestSdkAccessButton';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {hasTempestAccess} from 'sentry/utils/tempest/features';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import DevKitSettings from './DevKitSettings';
import PlayStationSettings from './PlayStationSettings';

type Tab = 'retail' | 'devkit-crashes';

const TAB_LABELS: Record<Tab, string> = {
  retail: t('Retail'),
  'devkit-crashes': t('DevKit'),
};

const PS5_WARNING_DISMISS_KEY = 'tempest-ps5-warning-dismissed';

export default function TempestSettings() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const location = useLocation();
  const navigate = useNavigate();
  const {dismiss: dismissPS5Warning, isDismissed: isPS5WarningDismissed} =
    useDismissAlert({
      key: PS5_WARNING_DISMISS_KEY,
    });

  const getCurrentTab = (): Tab => {
    const queryTab = decodeScalar(location?.query?.tab);
    return (
      ['retail', 'devkit-crashes'].includes(queryTab || '') ? queryTab : 'devkit-crashes'
    ) as Tab;
  };

  const tab = getCurrentTab();

  const handleTabChange = (newTab: Tab) => {
    const newQuery: any = {
      ...location.query,
      tab: newTab,
    };
    // Reset guided step when switching tabs to avoid cross-tab bleed
    delete newQuery.guidedStep;
    // setupInstructions is only available on the retail tab
    delete newQuery.setupInstructions;
    navigate({
      pathname: location.pathname,
      query: newQuery,
    });
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

  const renderPlayStationSettings = () => {
    return <PlayStationSettings organization={organization} project={project} />;
  };

  const renderDevKitCrashesSettings = () => {
    return <DevKitSettings organization={organization} project={project} />;
  };

  const renderTabContent = () => {
    switch (tab) {
      case 'retail':
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
      case 'retail':
      default:
        return t('Retail');
    }
  };

  return (
    <Fragment>
      <SentryDocumentTitle title={getPageTitle()} />
      <SettingsPageHeader
        title={getPageTitle()}
        action={
          <ButtonBar gap="lg">
            <FeedbackButton />
            <RequestSdkAccessButton
              gamingPlatform="playstation"
              organization={organization}
              projectId={project.id}
              origin="project-settings"
            />
          </ButtonBar>
        }
      />

      {!isPS5WarningDismissed && (
        <div>
          <Alert.Container>
            <Alert
              variant="warning"
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
