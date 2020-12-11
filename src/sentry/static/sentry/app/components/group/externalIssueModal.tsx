import React from 'react';

import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import {ExternalIssueAction} from 'app/components/externalIssues/abstractExternalIssueForm';
import ExternalIssueForm from 'app/components/group/externalIssueForm';
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
  action?: ExternalIssueAction;
};

class ExternalIssueModal extends React.Component<Props, State> {
  state: State = {
    action: 'create',
  };

  handleClick = (action: ExternalIssueAction) => {
    this.setState({action});
  };

  render() {
    const {closeModal, group, integration, onChange} = this.props;
    const {action} = this.state;

    if (!action) {
      return <React.Fragment />;
    }

    return (
      <ExternalIssueForm
        action={action}
        group={group}
        integration={integration}
        // Need the key here so React will re-render with a new action prop.
        key={action}
        handleClick={this.handleClick}
        onSubmitSuccess={(_, onSuccess) => {
          onChange(() => onSuccess());
          closeModal();
        }}
      />
    );
  }
}

export default withApi(ExternalIssueModal);
