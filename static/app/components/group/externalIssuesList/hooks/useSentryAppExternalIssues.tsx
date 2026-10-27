import {useQuery} from '@tanstack/react-query';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {deleteExternalIssue} from 'sentry/actionCreators/platformExternalIssues';
import {sentryAppInstallationsApiOptions} from 'sentry/actionCreators/sentryAppInstallations';
import type {GroupIntegrationIssueResult} from 'sentry/components/group/externalIssuesList/hooks/types';
import {useExternalIssues} from 'sentry/components/group/externalIssuesList/useExternalIssues';
import {openSentryAppIssueModal} from 'sentry/components/group/sentryAppExternalIssueModal';
import {SentryAppComponentIcon} from 'sentry/components/sentryAppComponentIcon';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSentryAppComponents} from 'sentry/utils/useSentryAppComponents';

export function useSentryAppExternalIssues({
  group,
  event,
}: {
  event: Event | undefined;
  group: Group;
}): GroupIntegrationIssueResult {
  const api = useApi();
  const organization = useOrganization();
  const {
    data: externalIssues,
    isLoading,
    onDeleteExternalIssue,
  } = useExternalIssues({
    group,
    organization,
  });
  const sentryAppComponents = useSentryAppComponents({
    componentType: 'issue-link',
  });
  // Tickets from installed apps without an issue-link component still show,
  // components alone can't tell us those apps are installed
  const {data: sentryAppInstallations = []} = useQuery(
    sentryAppInstallationsApiOptions({orgSlug: organization.slug})
  );

  const result: GroupIntegrationIssueResult = {
    integrations: [],
    linkedIssues: [],
    isLoading,
  };

  const displayedExternalIssues = new Set<string>();
  for (const component of sentryAppComponents) {
    const externalIssue = externalIssues.find(
      i => i.serviceType === component.sentryApp.slug
    );
    const appDisplayName = component.sentryApp.name;
    const displayIcon = (
      <SentryAppComponentIcon sentryAppComponent={component} size={14} />
    );
    if (externalIssue) {
      result.linkedIssues.push({
        key: `sentryapp-linked-${externalIssue.id}`,
        displayName: externalIssue.displayName,
        url: externalIssue.webUrl,
        // Some display names look like PROJ#1234
        // Others look like ClickUp: Title
        // Add the integration name if it's not already included
        title: externalIssue.displayName.includes(appDisplayName)
          ? externalIssue.displayName
          : `${appDisplayName}: ${externalIssue.displayName}`,
        displayIcon,
        onUnlink: () => {
          deleteExternalIssue(api, organization.slug, group.id, externalIssue.id)
            .then(_data => {
              onDeleteExternalIssue(externalIssue);
              addSuccessMessage(t('Successfully unlinked issue.'));
            })
            .catch(_error => {
              addErrorMessage(t('Unable to unlink issue.'));
            });
        },
      });

      displayedExternalIssues.add(externalIssue.id);
    } else {
      result.integrations.push({
        key: `sentryapp-${component.sentryApp.slug}`,
        displayName: appDisplayName,
        displayIcon,
        disabled: Boolean(component.error),
        disabledText: t('Unable to connect to %s', appDisplayName),
        actions: [
          {
            id: component.sentryApp.slug,
            name: 'Create Issue',
            onClick: () => {
              openSentryAppIssueModal({
                organization,
                group,
                event,
                sentryAppComponent: component,
                sentryAppInstallationUuid: component.installationUuid,
              });
            },
          },
        ],
      });
    }
  }

  for (const externalIssue of externalIssues) {
    // Loop through to find any issues that are not already displayed
    if (displayedExternalIssues.has(externalIssue.id)) {
      continue;
    }

    // Match the components endpoint, which only covers installed apps
    const isInstalled = sentryAppInstallations.some(
      i => i.status === 'installed' && i.app.slug === externalIssue.serviceType
    );
    if (!isInstalled) {
      continue;
    }

    result.linkedIssues.push({
      key: `sentryapp-linked-${externalIssue.id}`,
      displayName: externalIssue.displayName,
      url: externalIssue.webUrl,
      title: externalIssue.displayName,
      onUnlink: () => {
        deleteExternalIssue(api, organization.slug, group.id, externalIssue.id)
          .then(_data => {
            onDeleteExternalIssue(externalIssue);
            addSuccessMessage(t('Successfully unlinked issue.'));
          })
          .catch(_error => {
            addErrorMessage(t('Unable to unlink issue.'));
          });
      },
    });

    displayedExternalIssues.add(externalIssue.id);
  }

  return result;
}
