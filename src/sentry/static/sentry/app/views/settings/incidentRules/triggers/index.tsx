import React from 'react';
import styled, {css} from 'react-emotion';

import {IncidentRule, Trigger} from 'app/views/settings/incidentRules/types';
import {Organization, Project} from 'app/types';
import {openModal} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import Button from 'app/components/button';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TriggersList from 'app/views/settings/incidentRules/triggers/list';
import TriggersModal from 'app/views/settings/incidentRules/triggers/modal';
import withProjects from 'app/utils/withProjects';

type Props = {
  organization: Organization;
  projects: Project[];
  incidentRuleId?: string;
  rule: IncidentRule;

  onAdd: (trigger: Trigger) => void;
  onEdit: (trigger: Trigger) => void;
  onDelete: (trigger: Trigger) => void;
};

class Triggers extends React.Component<Props> {
  openTriggersModal = (trigger?: Trigger) => {
    const {organization, projects, rule, onAdd, onEdit} = this.props;

    openModal(
      ({closeModal}) => (
        <TriggersModal
          organization={organization}
          projects={projects}
          rule={rule}
          trigger={trigger}
          closeModal={closeModal}
          onSave={trigger ? onEdit : onAdd}
        />
      ),
      {
        dialogClassName: css`
          width: 80%;
          margin-left: -40%;
        `,
      }
    );
  };

  handleNewTrigger = () => {
    this.openTriggersModal();
  };

  handleEditTrigger = (trigger: Trigger) => {
    this.openTriggersModal(trigger);
  };

  render() {
    const {rule, onDelete} = this.props;

    return (
      <React.Fragment>
        <TriggersHeader
          title={t('Triggers')}
          action={
            <Button
              type="button"
              size="small"
              priority="primary"
              icon="icon-circle-add"
              disabled={!rule}
              onClick={this.handleNewTrigger}
            >
              {t('New Trigger')}
            </Button>
          }
        />

        <TriggersList
          triggers={rule.triggers}
          onDelete={onDelete}
          onEdit={this.handleEditTrigger}
        />
      </React.Fragment>
    );
  }
}

export default withProjects(Triggers);

const TriggersHeader = styled(SettingsPageHeader)`
  margin: 0;
`;
