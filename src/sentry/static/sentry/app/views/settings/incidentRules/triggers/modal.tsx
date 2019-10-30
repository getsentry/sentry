import React from 'react';
import styled from 'react-emotion';

import {IncidentRule, Trigger} from 'app/views/settings/incidentRules/types';
import {Organization, Project} from 'app/types';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import TriggerForm from 'app/views/settings/incidentRules/triggers/form';
import space from 'app/styles/space';

type Props = {
  organization: Organization;
  projects: Project[];
  rule: IncidentRule;
  closeModal: Function;
  trigger?: Trigger;
  onSubmitSuccess: Function;
};

class TriggersModal extends React.Component<Props> {
  handleSubmitSuccess = (newTrigger: Trigger) => {
    const {onSubmitSuccess, closeModal, trigger} = this.props;

    if (trigger) {
      addSuccessMessage(
        tct('Successfully updated trigger: [label]', {label: newTrigger.label})
      );
    } else {
      addSuccessMessage(
        tct('Successfully saved trigger: [label]', {label: newTrigger.label})
      );
    }
    onSubmitSuccess(newTrigger);
    closeModal();
  };

  handleSubmitError = () => {
    addErrorMessage(t('There was a problem saving trigger'));
  };

  render() {
    const {organization, projects, rule, trigger} = this.props;
    return (
      <div>
        <TinyHeader>{t('Trigger for')}</TinyHeader>
        <RuleName>{rule.name}</RuleName>
        <TriggerForm
          organization={organization}
          orgId={organization.slug}
          onSubmitSuccess={this.handleSubmitSuccess}
          projects={projects}
          rule={rule}
          trigger={trigger}
        />
      </div>
    );
  }
}

export default TriggersModal;

const TinyHeader = styled('h6')`
  color: ${p => p.theme.gray2};
  text-transform: uppercase;
  margin-bottom: ${space(1)};

  &::after {
    content: ':';
  }
`;

const RuleName = styled('h3')`
  font-weight: normal;
`;
