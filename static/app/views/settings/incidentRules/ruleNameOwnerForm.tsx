import {PureComponent} from 'react';

import Feature from 'app/components/acl/feature';
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
  userTeamIds: Set<string>;
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
          <Feature features={['organizations:team-alerts-ownership']}>
            <FormField
              name="owner"
              label={t('Team')}
              help={t('The team that can edit this alert.')}
            >
              {({model}) => {
                const owner = model.getValue('owner');
                const ownerId = owner && owner.split(':')[1];
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
                    filteredTeamIds={userTeamIds}
                    includeUnassigned
                  />
                );
              }}
            </FormField>
          </Feature>
        </PanelBody>
      </Panel>
    );
  }
}

export default RuleNameOwnerForm;
