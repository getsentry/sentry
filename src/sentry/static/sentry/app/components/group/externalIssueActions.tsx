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
  integration: GroupIntegration;
  group: Group;
};

type State = AsyncComponent['state'] & {
  showModal: boolean;
  action: 'create' | 'link' | null;
  selectedIntegration: GroupIntegration;
  issue: IntegrationExternalIssue | null;
};
class ExternalIssueActions extends AsyncComponent<Props, State> {
  static propTypes = {
    group: PropTypes.object.isRequired,
    integration: PropTypes.object.isRequired,
  };

  constructor(props: Props, context) {
    super(props, context);

    this.state = {
      showModal: false,
      action: 'create',
      selectedIntegration: this.props.integration,
      issue: this.getIssue(),
      ...this.getDefaultState(),
    };
  }

  getEndpoints() {
    return [];
  }

  getIssue() {
    return this.props.integration && this.props.integration.externalIssues
      ? this.props.integration.externalIssues[0]
      : null;
  }

  deleteIssue(issueId: string) {
    const {group, integration} = this.props;
    const endpoint = `/groups/${group.id}/integrations/${integration.id}/?externalIssue=${issueId}`;
    this.api.request(endpoint, {
      method: 'DELETE',
      success: () => {
        addSuccessMessage(t('Successfully unlinked issue.'));
        this.setState({
          issue: null,
        });
      },
      error: () => {
        addErrorMessage(t('Unable to unlink issue.'));
      },
    });
  }

  openModal = () => {
    const {integration} = this.props;
    this.setState({
      showModal: true,
      selectedIntegration: integration,
      action: 'create',
    });
  };

  closeModal = data => {
    this.setState({
      showModal: false,
      action: null,
      issue: data && data.id ? data : null,
    });
  };

  handleClick = (action: 'create' | 'link') => {
    this.setState({action});
  };

  renderBody() {
    const {action, selectedIntegration, issue} = this.state;

    return (
      <React.Fragment>
        <IssueSyncListElement
          onOpen={this.openModal}
          externalIssueLink={issue ? issue.url : null}
          externalIssueId={issue ? issue.id : null}
          externalIssueKey={issue ? issue.key : null}
          externalIssueDisplayName={issue ? issue.displayName : null}
          onClose={this.deleteIssue.bind(this)}
          integrationType={selectedIntegration.provider.key}
          hoverCardHeader={t('Linked %s Integration', selectedIntegration.provider.name)}
          hoverCardBody={
            issue && issue.title ? (
              <div>
                <IssueTitle>{issue.title}</IssueTitle>
                {issue.description && (
                  <IssueDescription>{issue.description}</IssueDescription>
                )}
              </div>
            ) : (
              <IntegrationItem integration={selectedIntegration} />
            )
          }
        />
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
                  onSubmitSuccess={this.closeModal}
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

export default ExternalIssueActions;
