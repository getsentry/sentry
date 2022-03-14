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
    <StyledTextField
      hasAlertWizardV3={hasAlertWizardV3}
      disabled={disabled}
      name="name"
      label={hasAlertWizardV3 ? null : t('Rule Name')}
      help={hasAlertWizardV3 ? null : t('Add a name so it’s easy to find later.')}
      placeholder={t('Something really bad happened')}
      required
    />
  );

  const renderTeamSelect = () => (
    <StyledFormField
      hasAlertWizardV3={hasAlertWizardV3}
      name="owner"
      label={hasAlertWizardV3 ? null : t('Team')}
      help={hasAlertWizardV3 ? null : t('The team that can edit this alert.')}
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
    </StyledFormField>
  );

  return hasAlertWizardV3 ? (
    <Fragment>
      <StyledListItem>{t('Add a name')}</StyledListItem>
      {renderRuleName()}
      <StyledListItem>{t('Assign this alert')}</StyledListItem>
      {renderTeamSelect()}
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

const StyledTextField = styled(TextField)<{hasAlertWizardV3: boolean}>`
  ${p =>
    p.hasAlertWizardV3 &&
    `
    border-bottom: none;
    padding: 0;

    & > div {
      padding: 0;
    }

    margin-bottom: ${space(2)};
  `}
`;

const StyledFormField = styled(FormField)<{hasAlertWizardV3: boolean}>`
  ${p =>
    p.hasAlertWizardV3 &&
    `
    padding: 0;

    & > div {
      padding: 0;
    }

    margin-bottom: ${space(2)};
  `}
`;
