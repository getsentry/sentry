import {Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import IssueSyncListElement from 'sentry/components/issueSyncListElement';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {GroupIntegration} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import IntegrationItem from 'sentry/views/settings/organizationIntegrations/integrationItem';

import ExternalIssueForm from '../externalIssueForm';

type Props = {
  configurations: GroupIntegration[];
  group: Group;
  onChange: (onSuccess?: () => void, onError?: () => void) => void;
};

type LinkedIssues = {
  linked: GroupIntegration[];
  unlinked: GroupIntegration[];
};

export const doOpenExternalIssueModal = ({
  group,
  integration,
  onChange,
  organization,
}: {
  group: Group;
  integration: GroupIntegration;
  onChange: () => void;
  organization: Organization;
}) => {
  trackAnalytics('issue_details.external_issue_modal_opened', {
    organization,
    ...getAnalyticsDataForGroup(group),
    external_issue_provider: integration.provider.key,
    external_issue_type: 'first_party',
  });

  openModal(
    deps => (
      <ExternalIssueForm {...deps} {...{group, onChange, integration, organization}} />
    ),
    {closeEvents: 'escape-key'}
  );
};

function ExternalIssueActions({configurations, group, onChange}: Props) {
  const organization = useOrganization();
  const api = useApi();
  const {linked, unlinked} = configurations
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
    .reduce(
      (acc: LinkedIssues, curr) => {
        if (curr.externalIssues.length) {
          acc.linked.push(curr);
        } else {
          acc.unlinked.push(curr);
        }
        return acc;
      },
      {linked: [], unlinked: []}
    );

  const deleteIssue = (integration: GroupIntegration) => {
    const {externalIssues} = integration;
    // Currently we do not support a case where there is multiple external issues.
    // For example, we shouldn't have more than 1 jira ticket created for an issue for each jira configuration.
    const issue = externalIssues[0]!;
    const {id} = issue;
    const endpoint = `/organizations/${organization.slug}/issues/${group.id}/integrations/${integration.id}/?externalIssue=${id}`;

    api.request(endpoint, {
      method: 'DELETE',
      success: () => {
        onChange(
          () => addSuccessMessage(t('Successfully unlinked issue.')),
          () => addErrorMessage(t('Unable to unlink issue.'))
        );
      },
      error: () => {
        addErrorMessage(t('Unable to unlink issue.'));
      },
    });
  };

  return (
    <Fragment>
      {linked.map(config => {
        const {provider, externalIssues} = config;
        const issue = externalIssues[0]!;
        return (
          <IssueSyncListElement
            key={issue.id}
            externalIssueLink={issue.url}
            externalIssueId={issue.id}
            externalIssueKey={issue.key}
            externalIssueDisplayName={issue.displayName}
            onClose={() => deleteIssue(config)}
            integrationType={provider.key}
            hoverCardHeader={t('%s Integration', provider.name)}
            hoverCardBody={
              <div>
                <IssueTitle>{issue.title}</IssueTitle>
                {issue.description && (
                  <IssueDescription>{issue.description}</IssueDescription>
                )}
              </div>
            }
          />
        );
      })}

      {unlinked.length > 0 && (
        <IssueSyncListElement
          integrationType={unlinked[0]!.provider.key}
          hoverCardHeader={t('%s Integration', unlinked[0]!.provider.name)}
          hoverCardBody={
            <Container>
              {unlinked.map(config => (
                <Wrapper
                  onClick={() =>
                    doOpenExternalIssueModal({
                      group,
                      integration: config,
                      onChange,
                      organization,
                    })
                  }
                  key={config.id}
                >
                  <IntegrationItem integration={config} />
                </Wrapper>
              ))}
            </Container>
          }
          onOpen={
            unlinked.length === 1
              ? () =>
                  doOpenExternalIssueModal({
                    group,
                    integration: unlinked[0]!,
                    onChange,
                    organization,
                  })
              : undefined
          }
        />
      )}
    </Fragment>
  );
}

const IssueTitle = styled('div')`
  font-size: 1.1em;
  font-weight: ${p => p.theme.fontWeightBold};
  ${p => p.theme.overflowEllipsis};
`;

const IssueDescription = styled('div')`
  margin-top: ${space(1)};
  ${p => p.theme.overflowEllipsis};
`;

const Wrapper = styled('div')`
  margin-bottom: ${space(2)};
  cursor: pointer;
`;

const Container = styled('div')`
  & > div:last-child {
    margin-bottom: ${space(1)};
  }
`;

export default ExternalIssueActions;
