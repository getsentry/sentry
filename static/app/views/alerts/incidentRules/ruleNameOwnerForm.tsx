import {Fragment} from 'react';
import * as React from 'react';
import styled from '@emotion/styled';

import FormField from 'sentry/components/forms/formField';
import TeamSelector from 'sentry/components/forms/teamSelector';
import TextField from 'sentry/components/forms/textField';
import ListItem from 'sentry/components/list/listItem';
import {Panel, PanelBody} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Project, Team} from 'sentry/types';

type Props = {
  disabled: boolean;
  hasAlertWizardV3: boolean;
  project: Project;
};

export default function RuleNameOwnerForm({disabled, project, hasAlertWizardV3}: Props) {
  const renderRuleName = () => (
    <TextField
      disabled={disabled}
      name="name"
      label={t('Rule Name')}
      help={t('Add a name so it’s easy to find later.')}
      placeholder={t('Something really bad happened')}
      required
    />
  );

  const renderTeamSelect = () => (
    <FormField
      name="owner"
      label={t('Team')}
      help={t('The team that can edit this alert.')}
      disabled={disabled}
    >
      {({model}) => {
        const owner = model.getValue('owner');
        const ownerId = owner && owner.split(':')[1];
        return (
          <TeamSelector
            value={ownerId}
            project={project}
            onChange={({value}) => {
              const ownerValue = value && `team:${value}`;
              model.setValue('owner', ownerValue);
            }}
            teamFilter={(team: Team) => team.isMember || team.id === ownerId}
            useId
            includeUnassigned
            disabled={disabled}
          />
        );
      }}
    </FormField>
  );

  return hasAlertWizardV3 ? (
    <Fragment>
      <StyledListItem>{t('Add a name')}</StyledListItem>
      <Panel>
        <PanelBody>{renderRuleName()}</PanelBody>
      </Panel>
      <StyledListItem>{t('Assign this alert')}</StyledListItem>
      <Panel>
        <PanelBody>{renderTeamSelect()}</PanelBody>
      </Panel>
    </Fragment>
  ) : (
    <Fragment>
      <StyledListItem>{t('Add a rule name and team')}</StyledListItem>
      <Panel>
        <PanelBody>
          {renderRuleName()}
          {renderTeamSelect()}
        </PanelBody>
      </Panel>
    </Fragment>
  );
}

const StyledListItem = styled(ListItem)`
  margin: ${space(2)} 0 ${space(1)} 0;
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;
