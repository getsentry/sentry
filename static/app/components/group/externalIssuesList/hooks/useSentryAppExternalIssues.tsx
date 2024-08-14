import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {deleteExternalIssue} from 'sentry/actionCreators/platformExternalIssues';
import type {GroupIntegrationIssueResult} from 'sentry/components/group/externalIssuesList/hooks/types';
import {useExternalIssues} from 'sentry/components/group/externalIssuesList/useExternalIssues';
import {doOpenSentryAppIssueModal} from 'sentry/components/group/sentryAppExternalIssueActions';
import SentryAppComponentIcon from 'sentry/components/sentryAppComponentIcon';
import {t} from 'sentry/locale';
import SentryAppInstallationStore from 'sentry/stores/sentryAppInstallationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useSentryAppComponentsStore from 'sentry/utils/useSentryAppComponentsStore';

export function useSentryAppExternalIssues({
  group,
  event,
}: {
  event: Event;
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
  const sentryAppComponents = useSentryAppComponentsStore({componentType: 'issue-link'});
  const sentryAppInstallations = useLegacyStore(SentryAppInstallationStore);

  const result: GroupIntegrationIssueResult = {
    integrations: [],
    linkedIssues: [],
    isLoading,
  };

  for (const component of sentryAppComponents) {
    const installation = sentryAppInstallations.find(
      i => i.app.uuid === component.sentryApp.uuid
    );

    if (!installation) {
      continue;
    }

    const externalIssue = externalIssues.find(
      i => i.serviceType === component.sentryApp.slug
    );
    const displayName = component.sentryApp.name;
    const displayIcon = (
      <SentryAppComponentIcon sentryAppComponent={component} size={14} />
    );
    if (externalIssue) {
      result.linkedIssues.push({
        key: externalIssue.id,
        displayName: `${displayName} Issue`,
        url: externalIssue.webUrl,
        title: externalIssue.displayName,
        displayIcon,
        onUnlink: () => {
          deleteExternalIssue(api, group.id, externalIssue.id)
            .then(_data => {
              onDeleteExternalIssue(externalIssue);
              addSuccessMessage(t('Successfully unlinked issue.'));
            })
            .catch(_error => {
              addErrorMessage(t('Unable to unlink issue.'));
            });
        },
      });
    } else {
      result.integrations.push({
        key: component.sentryApp.slug,
        displayName,
        displayIcon,
        disabled: Boolean(component.error),
        disabledText: t('Unable to connect to %s', displayName),
        actions: [
          {
            name: 'Create Issue',
            onClick: () => {
              doOpenSentryAppIssueModal({
                organization,
                group,
                event,
                sentryAppComponent: component,
                sentryAppInstallation: installation,
                externalIssue,
              });
            },
          },
        ],
      });
    }
  }

  return result;
}
