import {Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import AsyncComponent from 'sentry/components/asyncComponent';
import IssueSyncListElement from 'sentry/components/issueSyncListElement';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Group, GroupIntegration} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import IntegrationItem from 'sentry/views/organizationIntegrations/integrationItem';

import ExternalIssueForm from './externalIssueForm';

type Props = AsyncComponent['props'] & {
  configurations: GroupIntegration[];
  group: Group;
  onChange: (onSuccess?: () => void, onError?: () => void) => void;
};

type LinkedIssues = {
  linked: GroupIntegration[];
  unlinked: GroupIntegration[];
};

const ExternalIssueActions = ({configurations, group, onChange}: Props) => {
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
    const issue = externalIssues[0];
    const {id} = issue;
    const endpoint = `/groups/${group.id}/integrations/${integration.id}/?externalIssue=${id}`;

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

  const doOpenModal = (integration: GroupIntegration) =>
    openModal(
      deps => <ExternalIssueForm {...deps} {...{group, onChange, integration}} />,
      {allowClickClose: false}
    );

  return (
    <Fragment>
      {linked.map(config => {
        const {provider, externalIssues} = config;
        const issue = externalIssues[0];
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
          integrationType={unlinked[0].provider.key}
          hoverCardHeader={t('%s Integration', unlinked[0].provider.name)}
          hoverCardBody={
            <Container>
              {unlinked.map(config => (
                <Wrapper onClick={() => doOpenModal(config)} key={config.id}>
                  <IntegrationItem integration={config} />
                </Wrapper>
              ))}
            </Container>
          }
          onOpen={unlinked.length === 1 ? () => doOpenModal(unlinked[0]) : undefined}
        />
      )}
    </Fragment>
  );
};

const IssueTitle = styled('div')`
  font-size: 1.1em;
  font-weight: 600;
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
