import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {addLoadingMessage} from 'sentry/actionCreators/indicator';
import {BaseAvatar} from 'sentry/components/core/avatar/baseAvatar';
import {Button} from 'sentry/components/core/button';
import type {SelectKey, SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Installation = {
  avatar_url: string;
  github_organization: string;
  installation_id: number;
};

type GithubInstallationProps = {
  installation_info: Installation[];
};

export function GithubInstallationSelect({installation_info}: GithubInstallationProps) {
  const [model] = useState<FormModel>(() => new FormModel());
  const [installationID, setInstallationID] = useState<SelectKey | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleSubmit = (e: React.MouseEvent) => {
    e.preventDefault();
    const data = model.getData();
    addLoadingMessage(t('Submitting'));
    setIsSaving(true);
    model.setFormSaving();

    const {
      location: {origin},
    } = window;

    // redirect to the extensions endpoint with the form fields as query params
    // this is needed so we don't restart the pipeline loading from the original
    // OrganizationIntegrationSetupView route
    const chosen_installation_id = data.installation_id || -1;
    const currentParams = new URLSearchParams(window.location.search);
    const newParams = {
      ...Object.fromEntries(currentParams),
      chosen_installation_id,
    };

    const newUrl = `${origin}/extensions/github/setup/?${qs.stringify(newParams)}`;
    return window.location.assign(newUrl);
  };

  const handleSelect = ({value}: SelectOption<SelectKey>) => {
    setInstallationID(value);
    model.setValue('installation_id', value);
  };

  const selectOptions = installation_info.map(
    (installation): SelectOption<SelectKey> => ({
      value: installation.installation_id,
      label: (
        <OptionLabelWrapper>
          <StyledAvatar
            type="upload"
            uploadUrl={installation.avatar_url}
            size={16}
            title={installation.github_organization}
          />
          <span>{`${installation.github_organization}`}</span>
        </OptionLabelWrapper>
      ),
    })
  );

  return (
    <Fragment>
      <StyledList symbol="colored-numeric">
        <ListItem>
          <h3>{t('Select a Github Installation')}</h3>
          <Form model={model} hideFooter>
            <StyledSelect
              onChange={handleSelect}
              options={selectOptions}
              value={model.getValue('installation_id')}
            />
          </Form>
        </ListItem>
      </StyledList>
      <Footer>
        <StyledButton onClick={handleSubmit} disabled={isSaving || !installationID}>
          Next
        </StyledButton>
      </Footer>
    </Fragment>
  );
}

const StyledList = styled(List)`
  padding: 100px 50px 50px 50px;
`;

const Footer = styled('form')`
  width: 100%;
  display: flex;
  justify-content: flex-end;
  background-color: ${p => p.theme.bodyBackground};
  border-top: 1px solid ${p => p.theme.innerBorder};
  padding: ${space(2)};
`;

const StyledButton = styled(Button)`
  margin-left: ${space(1)};
`;

const OptionLabelWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const StyledAvatar = styled(BaseAvatar)`
  flex-shrink: 0;
`;

const StyledSelect = styled(CompactSelect)`
  width: 35%;
  > button {
    width: 100%;
  }
`;
