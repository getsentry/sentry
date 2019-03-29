import React from 'react';
import PropTypes from 'prop-types';
import Modal from 'react-bootstrap/lib/Modal';
import styled from 'react-emotion';

import withApi from 'app/utils/withApi';
import InlineSvg from 'app/components/inlineSvg';
import {addSuccessMessage, addErrorMessage} from 'app/actionCreators/indicator';
import AsyncComponent from 'app/components/asyncComponent';
import IssueSyncListElement, {
  IntegrationLink,
  IntegrationIcon,
} from 'app/components/issueSyncListElement';
import ExternalIssueForm, {
  SentryAppExternalIssueForm,
} from 'app/components/group/externalIssueForm';
import IntegrationItem from 'app/views/organizationIntegrations/integrationItem';
import NavTabs from 'app/components/navTabs';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

class ExternalIssueActions extends AsyncComponent {
  static propTypes = {
    group: PropTypes.object.isRequired,
    integration: PropTypes.object.isRequired,
  };

  constructor(props, context) {
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

  deleteIssue(issueId) {
    const {group, integration} = this.props;
    const endpoint = `/groups/${group.id}/integrations/${
      integration.id
    }/?externalIssue=${issueId}`;
    this.api.request(endpoint, {
      method: 'DELETE',
      success: (data, _, jqXHR) => {
        addSuccessMessage(t('Successfully unlinked issue.'));
        this.setState({
          issue: null,
        });
      },
      error: error => {
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

  handleClick = action => {
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
          integrationName={selectedIntegration.name}
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
            <NavTabs underlined={true}>
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

class SentryAppExternalIssueActions extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    group: PropTypes.object.isRequired,
    sentryAppComponent: PropTypes.object.isRequired,
    sentryAppInstallation: PropTypes.object,
    externalIssue: PropTypes.object,
  };

  constructor(props) {
    super(props);

    this.state = {
      action: 'create',
      externalIssue: props.externalIssue,
      showModal: false,
    };
  }

  componentDidUpdate(prevProps) {
    if (this.props.externalIssue !== prevProps.externalIssue) {
      this.updateExternalIssue(this.props.externalIssue);
    }
  }

  updateExternalIssue(externalIssue) {
    this.setState({externalIssue});
  }

  showModal = () => {
    // Only show the modal when we don't have a linked issue
    !this.state.externalIssue && this.setState({showModal: true});
  };

  hideModal = () => {
    this.setState({showModal: false});
  };

  showLink = () => {
    this.setState({action: 'link'});
  };

  showCreate = () => {
    this.setState({action: 'create'});
  };

  deleteIssue = () => {
    const {api, group} = this.props;
    const {externalIssue} = this.state;
    const url = `/issues/${group.id}/external-issues/${externalIssue.id}/`;

    api.request(url, {
      method: 'DELETE',
      success: data => {
        this.setState({externalIssue: null});
        addSuccessMessage(t('Successfully unlinked issue.'));
      },
      error: error => {
        addErrorMessage(t('Unable to unlink issue.'));
      },
    });
  };

  onAddRemoveClick = () => {
    const {externalIssue} = this.state;

    if (!externalIssue) {
      this.showModal();
    } else {
      this.deleteIssue();
    }
  };

  onSubmitSuccess = externalIssue => {
    this.setState({externalIssue});
    this.hideModal();
  };

  iconExists() {
    try {
      require(`../../icons/${this.props.sentryAppComponent.sentryApp.slug}.svg`);
      return true;
    } catch (err) {
      return false;
    }
  }

  get link() {
    const {sentryAppComponent} = this.props;
    const {externalIssue} = this.state;
    const name = sentryAppComponent.sentryApp.name;

    let url = '#';
    let icon = 'icon-generic-box';
    let displayName = tct('Link [name] Issue', {name});

    if (externalIssue) {
      url = externalIssue.webUrl;
      displayName = externalIssue.displayName;
    }

    if (this.iconExists()) {
      icon = `icon-${sentryAppComponent.sentryApp.slug}`;
    }

    return (
      <IssueLinkContainer>
        <IssueLink>
          <IntegrationIcon src={icon} />
          <IntegrationLink onClick={this.showModal} href={url}>
            {displayName}
          </IntegrationLink>
        </IssueLink>
        <AddRemoveIcon
          src="icon-close"
          isLinked={!!externalIssue}
          onClick={this.onAddRemoveClick}
        />
      </IssueLinkContainer>
    );
  }

  get modal() {
    const {sentryAppComponent, sentryAppInstallation, api, group} = this.props;
    const {action, showModal} = this.state;

    return (
      <Modal show={showModal} onHide={this.hideModal} animation={false}>
        <Modal.Header closeButton>
          <Modal.Title>{`${sentryAppComponent.sentryApp.name} Issue`}</Modal.Title>
        </Modal.Header>
        <NavTabs underlined={true}>
          <li className={action === 'create' ? 'active create' : 'create'}>
            <a onClick={this.showCreate}>{t('Create')}</a>
          </li>
          <li className={action === 'link' ? 'active link' : 'link'}>
            <a onClick={this.showLink}>{t('Link')}</a>
          </li>
        </NavTabs>
        <Modal.Body>
          <SentryAppExternalIssueForm
            api={api}
            group={group}
            sentryAppInstallation={sentryAppInstallation}
            config={sentryAppComponent.schema}
            action={action}
            onSubmitSuccess={this.onSubmitSuccess}
          />
        </Modal.Body>
      </Modal>
    );
  }

  render() {
    return (
      <React.Fragment>
        {this.link}
        {this.modal}
      </React.Fragment>
    );
  }
}

const Wrapped = withApi(SentryAppExternalIssueActions);
export {Wrapped as SentryAppExternalIssueActions};

const IssueLink = styled('div')`
  display: flex;
  align-items: center;
  min-width: 0;
`;

const IssueLinkContainer = styled('div')`
  line-height: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const AddRemoveIcon = styled(InlineSvg)`
  height: ${space(1.5)};
  color: ${p => p.theme.gray4};
  transition: 0.2s transform;
  cursor: pointer;
  box-sizing: content-box;
  padding: ${space(1)};
  margin: -${space(1)};
  ${p => (p.isLinked ? '' : 'transform: rotate(45deg) scale(0.9);')};
`;

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
