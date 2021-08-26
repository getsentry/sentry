import {Component, Fragment} from 'react';

import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import SentryAppExternalIssueForm from 'app/components/group/sentryAppExternalIssueForm';
import NavTabs from 'app/components/navTabs';
import {t, tct} from 'app/locale';
import {
  Group,
  PlatformExternalIssue,
  SentryAppComponent,
  SentryAppInstallation,
} from 'app/types';
import {Event} from 'app/types/event';
import withApi from 'app/utils/withApi';

type Props = ModalRenderProps & {
  api: Client;
  group: Group;
  sentryAppComponent: SentryAppComponent;
  sentryAppInstallation: SentryAppInstallation;
  event: Event;
  onSubmitSuccess: (externalIssue: PlatformExternalIssue) => void;
};

type State = {
  action: 'create' | 'link';
};

class SentryAppExternalIssueModal extends Component<Props, State> {
  state: State = {
    action: 'create',
  };

  showLink = () => {
    this.setState({action: 'link'});
  };

  showCreate = () => {
    this.setState({action: 'create'});
  };

  onSubmitSuccess = (externalIssue: PlatformExternalIssue) => {
    this.props.onSubmitSuccess(externalIssue);
    this.props.closeModal();
  };

  render() {
    const {Header, Body, sentryAppComponent, sentryAppInstallation, group} = this.props;
    const {action} = this.state;
    const name = sentryAppComponent.sentryApp.name;
    const config = sentryAppComponent.schema[action];

    return (
      <Fragment>
        <Header closeButton>{tct('[name] Issue', {name})}</Header>
        <NavTabs underlined>
          <li className={action === 'create' ? 'active create' : 'create'}>
            <a onClick={this.showCreate}>{t('Create')}</a>
          </li>
          <li className={action === 'link' ? 'active link' : 'link'}>
            <a onClick={this.showLink}>{t('Link')}</a>
          </li>
        </NavTabs>
        <Body>
          <SentryAppExternalIssueForm
            group={group}
            sentryAppInstallation={sentryAppInstallation}
            appName={name}
            config={config}
            action={action}
            onSubmitSuccess={this.onSubmitSuccess}
            event={this.props.event}
          />
        </Body>
      </Fragment>
    );
  }
}

export default withApi(SentryAppExternalIssueModal);
