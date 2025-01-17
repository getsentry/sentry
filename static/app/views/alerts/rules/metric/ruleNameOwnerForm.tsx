import {Fragment} from 'react';
import styled from '@emotion/styled';

import TextField from 'sentry/components/forms/fields/textField';
import FormField from 'sentry/components/forms/formField';
import ListItem from 'sentry/components/list/listItem';
import TeamSelector from 'sentry/components/teamSelector';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

type Props = {
  disabled: boolean;
  project: Project;
};

export default function RuleNameOwnerForm({disabled, project}: Props) {
  const renderRuleName = () => (
    <StyledTextField
      data-test-id="alert-name"
      disabled={disabled}
      name="name"
      label={null}
      help={null}
      placeholder={t('Enter Alert Name')}
      required
      flexibleControlStateSize
    />
  );

  const renderTeamSelect = () => (
    <StyledFormField
      extraMargin
      name="owner"
      label={null}
      help={null}
      disabled={disabled}
      flexibleControlStateSize
    >
      {({model}: any) => {
        const owner = model.getValue('owner');
        const ownerId = owner?.split(':')[1];
        return (
          <TeamSelector
            value={ownerId}
            project={project}
            onChange={({value}: any) => model.setValue('owner', value && `team:${value}`)}
            teamFilter={(team: Team) =>
              team.isMember || team.id === ownerId || team.access.includes('team:admin')
            }
            useId
            includeUnassigned
            disabled={disabled}
          />
        );
      }}
    </StyledFormField>
  );

  return (
    <Fragment>
      <StyledListItem>{t('Establish ownership')}</StyledListItem>
      {renderRuleName()}
      {renderTeamSelect()}
    </Fragment>
  );
}

const StyledListItem = styled(ListItem)`
  margin: ${space(2)} 0 ${space(1)} 0;
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const StyledTextField = styled(TextField)`
  border-bottom: none;
  padding: 0;

  & > div {
    padding: 0;
    width: 100%;
  }

  margin-bottom: ${space(1)};
`;

const StyledFormField = styled(FormField)<{extraMargin?: boolean}>`
  padding: 0;

  & > div {
    padding: 0;
    width: 100%;
  }

  margin-bottom: ${p => `${p.extraMargin ? '60px' : space(1)}`};
`;
