import {Fragment} from 'react';
import styled from '@emotion/styled';

import TextField from 'sentry/components/forms/fields/textField';
import FormField from 'sentry/components/forms/formField';
import ListItem from 'sentry/components/list/listItem';
import {TeamSelector} from 'sentry/components/teamSelector';
import {t} from 'sentry/locale';
import type {Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

type Props = {
  disabled: boolean;
  project: Project;
};

export function RuleNameOwnerForm({disabled, project}: Props) {
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
  margin: ${p => p.theme.space.xl} 0 ${p => p.theme.space.md} 0;
  font-size: ${p => p.theme.font.size.xl};
`;

const StyledTextField = styled(TextField)`
  border-bottom: none;
  padding: 0;

  & > div {
    padding: 0;
    width: 100%;
  }

  margin-bottom: ${p => p.theme.space.md};
`;

const StyledFormField = styled(FormField)<{extraMargin?: boolean}>`
  padding: 0;

  & > div {
    padding: 0;
    width: 100%;
  }

  margin-bottom: ${p => (p.extraMargin ? '60px' : p.theme.space.md)};
`;
