import React from 'react';
import styled from 'react-emotion';

import {
  IncidentRule,
  UnsavedTrigger,
  Trigger,
} from 'app/views/settings/incidentRules/types';
import {Organization, Project} from 'app/types';
import {t} from 'app/locale';
import TriggerForm from 'app/views/settings/incidentRules/triggers/form';
import space from 'app/styles/space';

type Props = {
  organization: Organization;
  projects: Project[];
  rule: IncidentRule;
  closeModal: Function;
  trigger?: Trigger;
  onSave: (trigger: UnsavedTrigger) => void;
};

class TriggersModal extends React.Component<Props> {
  handleSave = (newTrigger: Trigger) => {
    const {onSave, closeModal} = this.props;

    onSave(newTrigger);
    closeModal();
  };

  render() {
    const {organization, projects, rule, trigger} = this.props;

    return (
      <div>
        <TinyHeader>{t('Trigger for')}</TinyHeader>
        <RuleName>{rule.name}</RuleName>
        <TriggerForm
          organization={organization}
          onSave={this.handleSave}
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
