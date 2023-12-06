import {useCallback, useEffect, useState} from 'react';

import {promptsCheck, promptsUpdate} from 'sentry/actionCreators/prompts';
import {Alert, AlertProps} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {ProjectSdkUpdates} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {promptIsDismissed} from 'sentry/utils/promptIsDismissed';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import withSdkUpdates from 'sentry/utils/withSdkUpdates';

interface InnerGlobalSdkSuggestionsProps extends AlertProps {
  className?: string;
  sdkUpdates?: ProjectSdkUpdates[] | null;
}

function InnerGlobalSdkUpdateAlert(
  props: InnerGlobalSdkSuggestionsProps
): React.ReactElement | null {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const [showUpdateAlert, setShowUpdateAlert] = useState<boolean>(false);

  const handleSnoozePrompt = useCallback(() => {
    promptsUpdate(api, {
      organizationId: organization.id,
      feature: 'sdk_updates',
      status: 'snoozed',
    });

    trackAnalytics('sdk_updates.snoozed', {organization});
    setShowUpdateAlert(false);
  }, [api, organization]);

  const handleReviewUpdatesClick = useCallback(() => {
    SidebarPanelStore.activatePanel(SidebarPanelKey.BROADCASTS);
    trackAnalytics('sdk_updates.clicked', {organization});
  }, [organization]);

  useEffect(() => {
    trackAnalytics('sdk_updates.seen', {organization});

    let isUnmounted = false;

    promptsCheck(api, {
      organizationId: organization.id,
      feature: 'sdk_updates',
    }).then(prompt => {
      if (isUnmounted) {
        return;
      }

      setShowUpdateAlert(!promptIsDismissed(prompt));
    });

    return () => {
      isUnmounted = true;
    };
  }, [api, organization]);

  if (!showUpdateAlert || !props.sdkUpdates?.length) {
    return null;
  }

  // withSdkUpdates explicitly only queries My Projects. This means that when
  // looking at any projects outside of My Projects (like All Projects), this
  // will only show the updates relevant to the to user.
  const projectSpecificUpdates =
    selection?.projects?.length === 0 || selection?.projects[0] === ALL_ACCESS_PROJECTS
      ? props.sdkUpdates
      : props.sdkUpdates.filter(
          update => selection?.projects?.includes(parseInt(update.projectId, 10))
        );

  // Check if we have at least one suggestion out of the list of updates
  if (projectSpecificUpdates.every(v => v.suggestions.length === 0)) {
    return null;
  }

  return (
    <Alert
      type="info"
      showIcon
      className={props.className}
      trailingItems={
        <ButtonBar gap={2}>
          <Button priority="link" size="xs" onClick={handleReviewUpdatesClick}>
            {t('Review updates')}
          </Button>
          <Button
            aria-label={t('Remind me later')}
            title={t('Dismiss for the next two weeks')}
            priority="link"
            size="xs"
            icon={<IconClose />}
            onClick={handleSnoozePrompt}
          />
        </ButtonBar>
      }
    >
      {t(
        `You have outdated SDKs in your projects. Update them for important fixes and features.`
      )}
    </Alert>
  );
}

const GlobalSdkUpdateAlert = withSdkUpdates(InnerGlobalSdkUpdateAlert);

export {GlobalSdkUpdateAlert, InnerGlobalSdkUpdateAlert};
