import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {deleteExternalIssue} from 'sentry/actionCreators/platformExternalIssues';
import {useExternalIssues} from 'sentry/components/group/externalIssuesList/useExternalIssues';
import {IntegrationLink} from 'sentry/components/issueSyncListElement';
import SentryAppComponentIcon from 'sentry/components/sentryAppComponentIcon';
import {Tooltip} from 'sentry/components/tooltip';
import {IconAdd, IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {
  PlatformExternalIssue,
  SentryAppComponent,
  SentryAppInstallation,
} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import {recordInteraction} from 'sentry/utils/recordSentryAppInteraction';
import useApi from 'sentry/utils/useApi';

import SentryAppExternalIssueModal from './sentryAppExternalIssueModal';

type Props = {
  event: Event;
  group: Group;
  organization: Organization;
  sentryAppComponent: SentryAppComponent;
  sentryAppInstallation: SentryAppInstallation;
  disabled?: boolean;
  externalIssue?: PlatformExternalIssue;
};

export const doOpenSentryAppIssueModal = ({
  organization,
  group,
  event,
  externalIssue,
  sentryAppComponent,
  sentryAppInstallation,
}: Omit<Props, 'disabled'>) => {
  // Only show the modal when we don't have a linked issue
  if (externalIssue) {
    return;
  }

  trackAnalytics('issue_details.external_issue_modal_opened', {
    organization,
    ...getAnalyticsDataForGroup(group),
    external_issue_provider: sentryAppComponent.sentryApp.slug,
    external_issue_type: 'sentry_app',
  });
  recordInteraction(
    sentryAppComponent.sentryApp.slug,
    'sentry_app_component_interacted',
    {
      componentType: 'issue-link',
    }
  );

  openModal(
    deps => (
      <SentryAppExternalIssueModal
        {...deps}
        {...{group, event, sentryAppComponent, sentryAppInstallation}}
      />
    ),
    {closeEvents: 'escape-key'}
  );
};

function SentryAppExternalIssueActions({
  organization,
  group,
  event,
  sentryAppComponent,
  sentryAppInstallation,
  disabled,
  externalIssue,
}: Props) {
  const api = useApi();
  const {onDeleteExternalIssue} = useExternalIssues({group, organization});

  const deleteIssue = () => {
    if (!externalIssue) {
      return;
    }

    deleteExternalIssue(api, group.id, externalIssue.id)
      .then(_data => {
        onDeleteExternalIssue(externalIssue);
        addSuccessMessage(t('Successfully unlinked issue.'));
      })
      .catch(_error => {
        addErrorMessage(t('Unable to unlink issue.'));
      });
  };

  const onAddRemoveClick = () => {
    if (!externalIssue) {
      doOpenSentryAppIssueModal({
        organization,
        group,
        event,
        sentryAppComponent,
        sentryAppInstallation,
      });
    } else {
      deleteIssue();
    }
  };

  const name = sentryAppComponent.sentryApp.name;

  let url = '#';
  let displayName: React.ReactNode | string = t('%s Issue', name);

  if (externalIssue) {
    url = externalIssue.webUrl;
    displayName = externalIssue.displayName;
  }

  return (
    <IssueLinkContainer>
      <IssueLink>
        <StyledSentryAppComponentIcon sentryAppComponent={sentryAppComponent} />
        <Tooltip
          title={tct('Unable to connect to [provider].', {
            provider: sentryAppComponent.sentryApp.name,
          })}
          disabled={!disabled}
          skipWrapper
        >
          <StyledIntegrationLink
            onClick={e =>
              disabled
                ? e.preventDefault()
                : doOpenSentryAppIssueModal({
                    organization,
                    group,
                    event,
                    sentryAppComponent,
                    sentryAppInstallation,
                  })
            }
            href={disabled ? undefined : url}
            disabled={disabled}
          >
            {displayName}
          </StyledIntegrationLink>
        </Tooltip>
      </IssueLink>
      {!disabled && (
        <StyledIcon onClick={() => !disabled && onAddRemoveClick()}>
          {externalIssue ? (
            <IconClose aria-label={t('Remove')} />
          ) : (
            <IconAdd aria-label={t('Add')} />
          )}
        </StyledIcon>
      )}
    </IssueLinkContainer>
  );
}

const StyledSentryAppComponentIcon = styled(SentryAppComponentIcon)`
  color: ${p => p.theme.textColor};
  width: ${space(3)};
  height: ${space(3)};
  cursor: pointer;
  flex-shrink: 0;
`;

const IssueLink = styled('div')`
  display: flex;
  align-items: center;
  min-width: 0;
`;

const StyledIntegrationLink = styled(IntegrationLink)<{disabled?: boolean}>`
  color: ${({disabled, theme}) => (disabled ? theme.disabled : theme.textColor)};
  ${p => p.disabled && 'cursor: not-allowed;'}
`;

const IssueLinkContainer = styled('div')`
  line-height: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const StyledIcon = styled('span')`
  color: ${p => p.theme.textColor};
  cursor: pointer;
`;

export default SentryAppExternalIssueActions;
