import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {addLoadingMessage} from 'sentry/actionCreators/indicator';
import {BaseAvatar} from 'sentry/components/core/avatar/baseAvatar';
import {Button} from 'sentry/components/core/button';
import type {SelectKey, SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
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
  const [installationID, setInstallationID] = useState<SelectKey | undefined>(undefined);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleSubmit = (e: React.MouseEvent, id?: SelectKey) => {
    e.preventDefault();
    addLoadingMessage(t('Submitting'));
    setIsSaving(true);

    const {
      location: {origin},
    } = window;

    // redirect to the extensions endpoint with the form fields as query params
    // this is needed so we don't restart the pipeline loading from the original
    // OrganizationIntegrationSetupView route
    const chosen_installation_id = id ?? installationID ?? -1;
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
  };

  const handleSkip = (e: React.MouseEvent) => {
    handleSubmit(e, -1);
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
      <StyledContainer>
        <StyledHeader>{t('Install on an Existing Github Organization')}</StyledHeader>
        <p>
          {t(
            'Sentry found existing integrations on your GitHub organizations. Select from the dropdown if you want to install on an already connected GitHub organization.'
          )}
        </p>
        <StyledSelect
          onChange={handleSelect}
          options={selectOptions}
          value={installationID}
          triggerLabel={installationID ? undefined : 'Choose Installation'}
        />

        <ButtonContainer>
          <Button onClick={handleSkip} disabled={isSaving}>
            Skip
          </Button>
          <StyledButton onClick={handleSubmit} disabled={isSaving || !installationID}>
            Install
          </StyledButton>
        </ButtonContainer>
      </StyledContainer>
    </Fragment>
  );
}

const StyledContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: ${space(2)};
  width: 25%;
  margin: 0 auto;
  margin-top: 10%;
`;

const ButtonContainer = styled('div')`
  display: flex;
  align-self: flex-end;
  padding-top: ${space(2)};
`;

const StyledButton = styled(Button)`
  margin-left: ${space(0.75)};
  &:not(:disabled) {
    background-color: #6c5fc7;
    color: #fff;
  }
`;

const StyledHeader = styled('h3')`
  margin-bottom: ${space(2)};
  width: 100%;
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
  width: 100%;
  > button {
    width: 100%;
  }
`;
