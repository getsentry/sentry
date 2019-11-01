import {RouteComponentProps} from 'react-router/lib/Router';
import {findIndex} from 'lodash';
import React from 'react';
import styled, {css} from 'react-emotion';

import {IncidentRule, Trigger} from 'app/views/settings/incidentRules/types';
import {Organization, Project} from 'app/types';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {deleteTrigger} from 'app/views/settings/incidentRules/actions';
import {openModal} from 'app/actionCreators/modal';
import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import RuleForm from 'app/views/settings/incidentRules/ruleForm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TriggersList from 'app/views/settings/incidentRules/triggers/list';
import TriggersModal from 'app/views/settings/incidentRules/triggers/modal';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

type RouteParams = {
  orgId: string;
  incidentRuleId: string;
};

type Props = {
  organization: Organization;
  projects: Project[];
};

type State = {
  rule: IncidentRule;
} & AsyncView['state'];

class IncidentRulesDetails extends AsyncView<
  RouteComponentProps<RouteParams, {}> & Props,
  State
> {
  getEndpoints() {
    const {orgId, incidentRuleId} = this.props.params;

    return [
      ['rule', `/organizations/${orgId}/alert-rules/${incidentRuleId}/`] as [
        string,
        string
      ],
    ];
  }

  openTriggersModal = (trigger?: Trigger) => {
    const {organization, projects} = this.props;
    const {rule} = this.state;

    openModal(
      ({closeModal}) => (
        <TriggersModal
          organization={organization}
          projects={projects}
          rule={rule}
          trigger={trigger}
          closeModal={closeModal}
          onSubmitSuccess={trigger ? this.handleEditedTrigger : this.handleAddedTrigger}
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

  handleAddedTrigger = (trigger: Trigger) => {
    this.setState(({rule}) => ({
      rule: {
        ...rule,
        triggers: [...rule.triggers, trigger],
      },
    }));
  };

  handleEditedTrigger = (trigger: Trigger) => {
    this.setState(({rule}) => {
      const triggerIndex = findIndex(rule.triggers, ({id}) => id === trigger.id);
      const triggers = [...rule.triggers];
      triggers.splice(triggerIndex, 1, trigger);

      return {
        rule: {
          ...rule,
          triggers,
        },
      };
    });
  };

  handleNewTrigger = () => {
    this.openTriggersModal();
  };

  handleEditTrigger = (trigger: Trigger) => {
    this.openTriggersModal(trigger);
  };

  handleDeleteTrigger = async (trigger: Trigger) => {
    const {organization} = this.props;

    // Optimistically update
    const triggerIndex = findIndex(this.state.rule.triggers, ({id}) => id === trigger.id);
    const triggersAfterDelete = [...this.state.rule.triggers];
    triggersAfterDelete.splice(triggerIndex, 1);

    this.setState(({rule}) => {
      return {
        rule: {
          ...rule,
          triggers: triggersAfterDelete,
        },
      };
    });

    try {
      await deleteTrigger(this.api, organization.slug, trigger);
    } catch (err) {
      addErrorMessage(
        tct('There was a problem deleting trigger: [label]', {label: trigger.label})
      );

      // Add trigger back to list
      this.setState(({rule}) => {
        const triggers = [...rule.triggers];
        triggers.splice(triggerIndex, 0, trigger);

        return {
          rule: {
            ...rule,
            triggers,
          },
        };
      });
    }
  };

  renderBody() {
    const {orgId, incidentRuleId} = this.props.params;
    const {rule} = this.state;

    return (
      <div>
        <SettingsPageHeader title={t('Edit Incident Rule')} />

        <RuleForm
          saveOnBlur
          orgId={orgId}
          incidentRuleId={incidentRuleId}
          initialData={rule}
        />

        <TriggersHeader
          title={t('Triggers')}
          action={
            <Button
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
          onDelete={this.handleDeleteTrigger}
          onEdit={this.handleEditTrigger}
        />
      </div>
    );
  }
}

export default withProjects(withOrganization(IncidentRulesDetails));

const TriggersHeader = styled(SettingsPageHeader)`
  margin: 0;
`;
