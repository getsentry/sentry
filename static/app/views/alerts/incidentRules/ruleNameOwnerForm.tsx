import {PureComponent} from 'react';

import {Panel, PanelBody} from 'app/components/panels';
import SelectMembers from 'app/components/selectMembers';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import FormField from 'app/views/settings/components/forms/formField';
import TextField from 'app/views/settings/components/forms/textField';

type Props = {
  disabled: boolean;
  project: Project;
  organization: Organization;
  userTeamIds: string[];
};

class RuleNameOwnerForm extends PureComponent<Props> {
  render() {
    const {disabled, project, organization, userTeamIds} = this.props;
    return (
      <Panel>
        <PanelBody>
          <TextField
            disabled={disabled}
            name="name"
            label={t('Rule Name')}
            help={t('Add a name so it’s easy to find later.')}
            placeholder={t('Something really bad happened')}
            required
          />

          <FormField
            name="owner"
            label={t('Team')}
            help={t('The team that can edit this alert.')}
            disabled={disabled}
          >
            {({model}) => {
              const owner = model.getValue('owner');
              const ownerId = owner && owner.split(':')[1];
              const filteredTeamIds = new Set(userTeamIds);
              // Add the current team that owns the alert
              if (ownerId) {
                filteredTeamIds.add(ownerId);
              }
              return (
                <SelectMembers
                  showTeam
                  project={project}
                  organization={organization}
                  value={ownerId}
                  onChange={({value}) => {
                    const ownerValue = value && `team:${value}`;
                    model.setValue('owner', ownerValue);
                  }}
                  filteredTeamIds={filteredTeamIds}
                  includeUnassigned
                  disabled={disabled}
                />
              );
            }}
          </FormField>
        </PanelBody>
      </Panel>
    );
  }
}

export default RuleNameOwnerForm;
