import React from 'react';
import PropTypes from 'prop-types';
import Modal from 'react-bootstrap/lib/Modal';
import styled from '@emotion/styled';

import {addSuccessMessage, addErrorMessage} from 'app/actionCreators/indicator';
import AsyncComponent from 'app/components/asyncComponent';
import IssueSyncListElement from 'app/components/issueSyncListElement';
import ExternalIssueForm from 'app/components/group/externalIssueForm';
import IntegrationItem from 'app/views/organizationIntegrations/integrationItem';
import NavTabs from 'app/components/navTabs';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Group, GroupIntegration, IntegrationExternalIssue} from 'app/types';

type Props = AsyncComponent['props'] & {
  configurations: GroupIntegration[];
  group: Group;
};

type State = AsyncComponent['state'] & {
  showModal: boolean;
  action: 'create' | 'link' | null;
  selectedIntegration: GroupIntegration | null;
  unlinked: GroupIntegration[];
  linked: GroupIntegration[];
};

type LinkedIssues = {
  linked: GroupIntegration[];
  unlinked: GroupIntegration[];
};

class ExternalIssueActions extends AsyncComponent<Props, State> {
  static propTypes = {
    group: PropTypes.object.isRequired,
  };

  constructor(props: Props, context) {
    super(props, context);

    this.state = {
      showModal: false,
      action: 'create',
      selectedIntegration: null,
      ...this.getDefaultState(),
      ...this.linkedIssuesFilter(),
    };
  }

  getEndpoints() {
    return [];
  }

  linkedIssuesFilter() {
    return this.props.configurations.reduce(
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
  }

  deleteIssue(integration: GroupIntegration) {
    const {group} = this.props;
    const {externalIssues} = integration;
    let issue = externalIssues[0];
    let {id} = issue;
    const endpoint = `/groups/${group.id}/integrations/${integration.id}/?externalIssue=${id}`;

    this.api.request(endpoint, {
      method: 'DELETE',
      success: () => {
        addSuccessMessage(t('Successfully unlinked issue.'));
        let unlinked = JSON.parse(JSON.stringify(integration)) as GroupIntegration;
        unlinked.externalIssues = [];
        this.setState({
          selectedIntegration: null,
          linked: this.state.linked.filter(config => config.id !== unlinked.id),
          unlinked: [...this.state.unlinked, unlinked],
        });
      },
      error: () => {
        addErrorMessage(t('Unable to unlink issue.'));
        this.setState({
          selectedIntegration: null,
        });
      },
    });
  }

  openModal = (integration: GroupIntegration) => {
    this.setState({
      showModal: true,
      selectedIntegration: integration,
      action: 'create',
    });
  };

  closeModal = () => {
    this.setState({
      showModal: false,
      action: null,
      selectedIntegration: null,
    });
  };

  handleClick = (action: 'create' | 'link') => {
    this.setState({action});
  };

  linkIssueSuccess = (
    integration: GroupIntegration,
    externalIssue: IntegrationExternalIssue
  ) => {
    let linked = JSON.parse(JSON.stringify(integration)) as GroupIntegration;
    linked.externalIssues = [externalIssue];
    this.setState(
      {
        linked: [...this.state.linked, linked],
        unlinked: this.state.unlinked.filter(config => config.id !== linked.id),
      },
      () => this.closeModal()
    );
  };

  renderBody() {
    const {action, selectedIntegration, linked, unlinked} = this.state;
    return (
      <React.Fragment>
        {linked.length > 0 &&
          linked.map(config => {
            const {provider, externalIssues} = config;
            let issue = externalIssues[0];
            return (
              <IssueSyncListElement
                key={issue.id}
                externalIssueLink={issue.url}
                externalIssueId={issue.id}
                externalIssueKey={issue.key}
                externalIssueDisplayName={issue.displayName}
                onClose={() => this.deleteIssue(config)}
                integrationType={provider.key}
                hoverCardHeader={t('Linked %s Integration', provider.name)}
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
            externalIssueLink={null}
            externalIssueId={null}
            externalIssueKey={null}
            externalIssueDisplayName={null}
            integrationType={unlinked[0].provider.key}
            hoverCardHeader={t('Linked %s Integration', unlinked[0].provider.name)}
            hoverCardBody={
              <Container>
                {unlinked
                  .sort((a, b) =>
                    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
                  )
                  .map(config => (
                    <Wrapper onClick={() => this.openModal(config)} key={config.id}>
                      <IntegrationItem integration={config} />
                    </Wrapper>
                  ))}
              </Container>
            }
          />
        )}
        {selectedIntegration && (
          <Modal
            show={this.state.showModal}
            onHide={this.closeModal}
            animation={false}
            enforceFocus={false}
            backdrop="static"
          >
            <Modal.Header closeButton>
              <Modal.Title>{`${selectedIntegration.provider.name} Issue`}</Modal.Title>
            </Modal.Header>
            <NavTabs underlined>
              <li className={action === 'create' ? 'active' : ''}>
                <a onClick={() => this.handleClick('create')}>{t('Create')}</a>
              </li>
              <li className={action === 'link' ? 'active' : ''}>
                <a onClick={() => this.handleClick('link')}>{t('Link')}</a>
              </li>
            </NavTabs>
            <Modal.Body>
              {action && (
                <ExternalIssueForm
                  // need the key here so React will re-render
                  // with a new action prop
                  key={action}
                  group={this.props.group}
                  integration={selectedIntegration}
                  action={action}
                  onSubmitSuccess={externalIssue =>
                    this.linkIssueSuccess(selectedIntegration, externalIssue)
                  }
                />
              )}
            </Modal.Body>
          </Modal>
        )}
      </React.Fragment>
    );
  }
}

const IssueTitle = styled('div')`
  font-size: 1.1em;
  font-weight: 600;
  ${overflowEllipsis};
`;

const IssueDescription = styled('div')`
  margin-top: ${space(1)};
  ${overflowEllipsis};
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
