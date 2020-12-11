import React from 'react';

import {Client} from 'app/api';
import {ModalRenderProps} from 'app/components/globalModal';
import ExternalIssueForm from 'app/components/group/externalIssueForm';
import NavTabs from 'app/components/navTabs';
import {t} from 'app/locale';
import {Group, GroupIntegration} from 'app/types';
import withApi from 'app/utils/withApi';

type Props = ModalRenderProps & {
  api: Client;
  configurations: GroupIntegration[];
  group: Group;
  onChange: (onSuccess?: () => void, onError?: () => void) => void;
  integration: GroupIntegration;
};

type State = {
  action: 'create' | 'link' | null;
};

class ExternalIssueModal extends React.Component<Props, State> {
  state: State = {
    action: 'create',
  };

  handleClick = (action: 'create' | 'link') => {
    this.setState({action});
  };

  render() {
    const {Header, Body, closeModal, integration, group} = this.props;
    const {action} = this.state;

    return (
      <React.Fragment>
        <Header closeButton>{`${integration.provider.name} Issue`}</Header>
        <NavTabs underlined>
          <li className={action === 'create' ? 'active' : ''}>
            <a onClick={() => this.handleClick('create')}>{t('Create')}</a>
          </li>
          <li className={action === 'link' ? 'active' : ''}>
            <a onClick={() => this.handleClick('link')}>{t('Link')}</a>
          </li>
        </NavTabs>
        <Body>
          {action && (
            <ExternalIssueForm
              // need the key here so React will re-render
              // with a new action prop
              key={action}
              group={group}
              integration={integration}
              action={action}
              onSubmitSuccess={(_, onSuccess) => {
                this.props.onChange(() => onSuccess());
                closeModal();
              }}
            />
          )}
        </Body>
      </React.Fragment>
    );
  }
}

export default withApi(ExternalIssueModal);
