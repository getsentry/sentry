import {Component, Fragment} from 'react';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import SentryAppExternalIssueForm from 'sentry/components/group/sentryAppExternalIssueForm';
import NavTabs from 'sentry/components/navTabs';
import {t, tct} from 'sentry/locale';
import {
  Group,
  PlatformExternalIssue,
  SentryAppComponent,
  SentryAppInstallation,
} from 'sentry/types';
import {Event} from 'sentry/types/event';

type Props = ModalRenderProps & {
  event: Event;
  group: Group;
  onSubmitSuccess: (externalIssue: PlatformExternalIssue) => void;
  sentryAppComponent: SentryAppComponent;
  sentryAppInstallation: SentryAppInstallation;
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

export default SentryAppExternalIssueModal;
