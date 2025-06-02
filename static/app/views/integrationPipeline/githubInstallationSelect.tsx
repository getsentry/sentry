import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {addLoadingMessage} from 'sentry/actionCreators/indicator';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {BaseAvatar} from 'sentry/components/core/avatar/baseAvatar';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import type {SelectKey, SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {IconAdd, IconLightning} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';

type Installation = {
  avatar_url: string;
  github_account: string;
  installation_id: string;
};

type GithubInstallationProps = {
  has_scm_multi_org: boolean;
  installation_info: Installation[];
  organization_slug: string;
};

export function GithubInstallationSelect({
  installation_info,
  has_scm_multi_org,
  organization_slug,
}: GithubInstallationProps) {
  // -1 represents the "Install on another organization"/Skip option
  const [installationID, setInstallationID] = useState<SelectKey>('-1');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const isSelfHosted = ConfigStore.get('isSelfHosted');
  const source = 'github.multi_org';
  const doesntRequireUpgrade = has_scm_multi_org || isSelfHosted;

  const handleSubmit = (e: React.MouseEvent, id?: SelectKey) => {
    e.preventDefault();
    addLoadingMessage(t('Submitting'));
    setIsSaving(true);

    const {
      location: {origin},
    } = window;

    // redirect to the extensions endpoint with the chosen installation as a query param
    // this is needed so we don't restart the pipeline loading from the original
    // OrganizationIntegrationSetupView route
    const chosenInstallationID = id ?? installationID;
    const currentParams = new URLSearchParams(window.location.search);
    const newParams = {
      ...Object.fromEntries(currentParams),
      chosen_installation_id: chosenInstallationID,
    };

    const newUrl = `${origin}/extensions/github/setup/?${qs.stringify(newParams)}`;
    return window.location.assign(newUrl);
  };

  const handleSelect = ({value}: SelectOption<SelectKey>) => {
    setInstallationID(value);
  };

  const selectOptions = installation_info.map(
    (installation): SelectOption<SelectKey> => ({
      value: installation.installation_id,
      label: (
        <OptionLabelWrapper>
          {installation.installation_id === '-1' ? (
            <IconAdd />
          ) : (
            <StyledAvatar
              type="upload"
              uploadUrl={installation.avatar_url}
              size={16}
              title={installation.github_account}
            />
          )}
          <span>{`${installation.github_account}`}</span>
          {installation.installation_id === '-1' || doesntRequireUpgrade ? (
            ''
          ) : (
            <IconLightning size="xs" />
          )}
        </OptionLabelWrapper>
      ),
    })
  );

  const renderInstallationButton = () => {
    if (installationID === '-1' || doesntRequireUpgrade) {
      return (
        <Button
          priority="primary"
          onClick={handleSubmit}
          disabled={isSaving || !installationID}
        >
          {t('Install')}
        </Button>
      );
    }

    if (isSelfHosted) {
      return (
        <FeatureDisabled
          features={['integrations-scm-multi-org']}
          featureName={t('Cross-Org Source Code Management')}
          hideHelpToggle
        />
      );
    }

    return (
      <LinkButton
        icon={<IconLightning />}
        priority="primary"
        onClick={() => {
          trackAnalytics(`${source}.upsell`, {
            organization: organization_slug,
          });
        }}
        href={`${origin}/settings/${organization_slug}/billing/overview/?referrer=upgrade-${source}`}
        disabled={isSaving || !installationID || isSelfHosted}
      >
        {t('Upgrade')}
      </LinkButton>
    );
  };

  return (
    <Fragment>
      <StyledContainer>
        <StyledHeader>{t('Install on an Existing Github Organization')}</StyledHeader>
        <p>
          {t(
            'We noticed you already integrated with Github! Do you want to connect an existing Github organization to this Sentry organization or connect a new one?'
          )}
        </p>
        <StyledSelect
          onChange={handleSelect}
          options={selectOptions}
          value={installationID}
          triggerLabel={installationID ? undefined : 'Choose Installation'}
        />
        <ButtonContainer>{renderInstallationButton()}</ButtonContainer>
      </StyledContainer>
    </Fragment>
  );
}

const StyledContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: ${space(2)};
  max-width: 33%;
  margin: 0 auto;
  margin-top: 10%;
`;

const ButtonContainer = styled('div')`
  display: flex;
  align-self: flex-end;
  padding-top: ${space(2)};
  flex-direction: column;
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
