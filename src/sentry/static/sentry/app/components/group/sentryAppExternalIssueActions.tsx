import { Component, Fragment, ReactElement } from 'react';
import PropTypes from 'prop-types';
import Modal from 'react-bootstrap/lib/Modal';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import withApi from 'app/utils/withApi';
import {IconAdd, IconClose} from 'app/icons';
import {addSuccessMessage, addErrorMessage} from 'app/actionCreators/indicator';
import {IntegrationLink} from 'app/components/issueSyncListElement';
import {SentryAppIcon} from 'app/components/sentryAppIcon';
import SentryAppExternalIssueForm from 'app/components/group/sentryAppExternalIssueForm';
import NavTabs from 'app/components/navTabs';
import {t, tct} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import {deleteExternalIssue} from 'app/actionCreators/platformExternalIssues';
import {recordInteraction} from 'app/utils/recordSentryAppInteraction';
import {
  Group,
  PlatformExternalIssue,
  Event,
  SentryAppComponent,
  SentryAppInstallation,
} from 'app/types';

type Props = {
  api: Client;
  group: Group;
  sentryAppComponent: SentryAppComponent;
  sentryAppInstallation: SentryAppInstallation;
  externalIssue?: PlatformExternalIssue;
  event: Event;
};

type State = {
  action: 'create' | 'link';
  externalIssue?: PlatformExternalIssue;
  showModal: boolean;
};

class SentryAppExternalIssueActions extends Component<Props, State> {
  static propTypes: any = {
    api: PropTypes.object.isRequired,
    group: SentryTypes.Group.isRequired,
    sentryAppComponent: PropTypes.object.isRequired,
    sentryAppInstallation: PropTypes.object.isRequired,
    externalIssue: PropTypes.object,
    event: SentryTypes.Event,
  };

  constructor(props: Props) {
    super(props);

    this.state = {
      action: 'create',
      externalIssue: props.externalIssue,
      showModal: false,
    };
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.externalIssue !== prevProps.externalIssue) {
      this.updateExternalIssue(this.props.externalIssue);
    }
  }

  updateExternalIssue(externalIssue?: PlatformExternalIssue) {
    this.setState({externalIssue});
  }

  showModal = () => {
    // Only show the modal when we don't have a linked issue
    if (!this.state.externalIssue) {
      const {sentryAppComponent} = this.props;

      recordInteraction(
        sentryAppComponent.sentryApp.slug,
        'sentry_app_component_interacted',
        {
          componentType: 'issue-link',
        }
      );
      this.setState({showModal: true});
    }
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

    externalIssue &&
      deleteExternalIssue(api, group.id, externalIssue.id)
        .then(_data => {
          this.setState({externalIssue: undefined});
          addSuccessMessage(t('Successfully unlinked issue.'));
        })
        .catch(_error => {
          addErrorMessage(t('Unable to unlink issue.'));
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

  onSubmitSuccess = (externalIssue: PlatformExternalIssue) => {
    this.setState({externalIssue});
    this.hideModal();
  };

  get link() {
    const {sentryAppComponent} = this.props;
    const {externalIssue} = this.state;
    const name = sentryAppComponent.sentryApp.name;

    let url = '#';
    let displayName: ReactElement | string = tct('Link [name] Issue', {name});

    if (externalIssue) {
      url = externalIssue.webUrl;
      displayName = externalIssue.displayName;
    }

    return (
      <IssueLinkContainer>
        <IssueLink>
          <StyledSentryAppIcon slug={sentryAppComponent.sentryApp.slug} />
          <IntegrationLink onClick={this.showModal} href={url}>
            {displayName}
          </IntegrationLink>
        </IssueLink>
        <StyledIcon onClick={this.onAddRemoveClick}>
          {!!externalIssue ? <IconClose /> : <IconAdd />}
        </StyledIcon>
      </IssueLinkContainer>
    );
  }

  get modal() {
    const {sentryAppComponent, sentryAppInstallation, group} = this.props;
    const {action, showModal} = this.state;
    const name = sentryAppComponent.sentryApp.name;
    const config = sentryAppComponent.schema[action];

    return (
      <Modal show={showModal} backdrop="static" onHide={this.hideModal} animation={false}>
        <Modal.Header closeButton>
          <Modal.Title>{tct('[name] Issue', {name})}</Modal.Title>
        </Modal.Header>
        <NavTabs underlined>
          <li className={action === 'create' ? 'active create' : 'create'}>
            <a onClick={this.showCreate}>{t('Create')}</a>
          </li>
          <li className={action === 'link' ? 'active link' : 'link'}>
            <a onClick={this.showLink}>{t('Link')}</a>
          </li>
        </NavTabs>
        <Modal.Body>
          <SentryAppExternalIssueForm
            group={group}
            sentryAppInstallation={sentryAppInstallation}
            appName={name}
            config={config}
            action={action}
            onSubmitSuccess={this.onSubmitSuccess}
            event={this.props.event}
          />
        </Modal.Body>
      </Modal>
    );
  }

  render() {
    return (
      <Fragment>
        {this.link}
        {this.modal}
      </Fragment>
    );
  }
}

// @ts-ignore ; TS2589: Type instantiation is excessively deep and possibly infinite.
const StyledSentryAppIcon = styled(SentryAppIcon)`
  color: ${p => p.theme.gray700};
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

const IssueLinkContainer = styled('div')`
  line-height: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const StyledIcon = styled('span')`
  color: ${p => p.theme.gray700};
  cursor: pointer;
`;

export default withApi(SentryAppExternalIssueActions);
