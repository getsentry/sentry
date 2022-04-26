import {Fragment, useCallback, useEffect, useState} from 'react';

import {promptsCheck, promptsUpdate} from 'sentry/actionCreators/prompts';
import Alert, {AlertProps} from 'sentry/components/alert';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {PageFilters, ProjectSdkUpdates} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {promptIsDismissed} from 'sentry/utils/promptIsDismissed';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import withSdkUpdates from 'sentry/utils/withSdkUpdates';

import {SidebarPanelKey} from './sidebar/types';
import Button from './button';

interface InnerGlobalSdkSuggestionsProps extends AlertProps {
  className?: string;
  sdkUpdates?: ProjectSdkUpdates[] | null;
  selection?: PageFilters;
}

function InnerGlobalSdkUpdateAlert(
  props: InnerGlobalSdkSuggestionsProps
): React.ReactElement | null {
  const api = useApi();
  const organization = useOrganization();

  const [showUpdateAlert, setShowUpdateAlert] = useState<boolean>(false);

  const handleSnoozePrompt = useCallback(() => {
    promptsUpdate(api, {
      organizationId: organization.id,
      feature: 'sdk_updates',
      status: 'snoozed',
    });

    trackAdvancedAnalyticsEvent('sdk_updates.snoozed', {organization});
    setShowUpdateAlert(false);
  }, [api, organization]);

  const handleReviewUpdatesClick = useCallback(() => {
    SidebarPanelStore.activatePanel(SidebarPanelKey.Broadcasts);
    trackAdvancedAnalyticsEvent('sdk_updates.clicked', {organization});
  }, []);

  useEffect(() => {
    trackAdvancedAnalyticsEvent('sdk_updates.seen', {organization});

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
  }, []);

  if (!showUpdateAlert || !props.sdkUpdates?.length) {
    return null;
  }

  // withSdkUpdates explicitly only queries My Projects. This means that when
  // looking at any projects outside of My Projects (like All Projects), this
  // will only show the updates relevant to the to user.
  const projectSpecificUpdates =
    props.selection?.projects?.length === 0 ||
    props.selection?.projects[0] === ALL_ACCESS_PROJECTS
      ? props.sdkUpdates
      : props.sdkUpdates.filter(update =>
          props.selection?.projects?.includes(parseInt(update.projectId, 10))
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
        <Fragment>
          <Button
            priority="link"
            size="zero"
            title={t('Dismiss for the next two weeks')}
            onClick={handleSnoozePrompt}
          >
            {t('Remind me later')}
          </Button>
          <span>|</span>
          <Button priority="link" size="zero" onClick={handleReviewUpdatesClick}>
            {t('Review updates')}
          </Button>
        </Fragment>
      }
    >
      {t(
        `You have outdated SDKs in your projects. Update them for important fixes and features.`
      )}
    </Alert>
  );
}

const WithSdkUpdatesGlobalSdkUpdateAlert = withSdkUpdates(
  withPageFilters(InnerGlobalSdkUpdateAlert)
);

export {
  WithSdkUpdatesGlobalSdkUpdateAlert as GlobalSdkUpdateAlert,
  InnerGlobalSdkUpdateAlert,
};
