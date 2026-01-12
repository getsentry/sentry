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
import {Flex, Stack} from 'sentry/components/core/layout';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {IconAdd, IconLightning} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {GithubInstallationInstallButtonProps} from 'sentry/types/hooks';
import type {Organization} from 'sentry/types/organization';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

type Installation = {
  avatar_url: string;
  github_account: string;
  installation_id: string;
};

type GithubInstallationProps = {
  installation_info: Installation[];
  organization: Organization;
};

function InstallationButton({
  handleSubmit,
  isSaving,
  installationID,
  hasSCMMultiOrg,
}: GithubInstallationInstallButtonProps) {
  if (installationID !== '-1' && !hasSCMMultiOrg) {
    return (
      <FeatureDisabled
        features={['integrations-scm-multi-org']}
        featureName={t('Cross-Org Source Code Management')}
        hideHelpToggle
      />
    );
  }

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

const InstallButtonHook = HookOrDefault({
  hookName: 'component:scm-multi-org-install-button',
  defaultComponent: InstallationButton,
});

export function GithubInstallationSelect({
  installation_info,
  organization,
}: GithubInstallationProps) {
  const [installationID, setInstallationID] = useState<SelectKey>('-1');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const hasSCMMultiOrg = organization.features.includes('integrations-scm-multi-org');
  const isSelfHosted = ConfigStore.get('isSelfHosted');
  const source = 'github.multi_org';

  const doesntRequireUpgrade = (id: SelectKey): boolean => {
    return hasSCMMultiOrg || isSelfHosted || id === '-1';
  };

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
    return testableWindowLocation.assign(newUrl);
  };

  const handleSelect = ({value}: SelectOption<SelectKey>) => {
    setInstallationID(value);
  };

  const selectOptions = installation_info.map(
    (installation): SelectOption<SelectKey> => ({
      value: installation.installation_id,
      textValue: installation.github_account,
      label: (
        <Flex align="center" gap="md">
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
          {!doesntRequireUpgrade(installation.installation_id) && (
            <IconLightning size="xs" />
          )}
        </Flex>
      ),
    })
  );

  const renderInstallationButtonOld = () => {
    if (installationID !== '-1' && isSelfHosted) {
      return (
        <FeatureDisabled
          features={['integrations-scm-multi-org']}
          featureName={t('Cross-Org Source Code Management')}
          hideHelpToggle
        />
      );
    }

    if (doesntRequireUpgrade(installationID)) {
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

    return (
      <LinkButton
        icon={<IconLightning />}
        priority="primary"
        analyticsEventKey="github.multi_org.upsell"
        analyticsEventName="Github Multi-Org Upsell Clicked"
        href={`${origin}/settings/${organization.slug}/billing/overview/?referrer=upgrade-${source}`}
        disabled={isSaving || !installationID || isSelfHosted}
      >
        {t('Upgrade')}
      </LinkButton>
    );
  };

  return (
    <Fragment>
      <StyledContainer>
        <StyledHeader>{t('Install on an Existing GitHub Organization')}</StyledHeader>
        <p>
          {t(
            'We noticed you already integrated with GitHub! Do you want to connect an existing GitHub organization to this Sentry organization or connect a new one?'
          )}
        </p>

        <StyledSelect
          onChange={handleSelect}
          options={selectOptions}
          value={installationID}
          triggerProps={{
            children: installationID ? undefined : 'Choose Installation',
          }}
        />
        <Stack alignSelf="flex-end" paddingTop="xl">
          {organization.features.includes('github-multi-org-upsell-modal') ? (
            <InstallButtonHook
              hasSCMMultiOrg={hasSCMMultiOrg}
              installationID={installationID}
              isSaving={isSaving}
              handleSubmit={handleSubmit}
            />
          ) : (
            renderInstallationButtonOld()
          )}
        </Stack>
      </StyledContainer>
    </Fragment>
  );
}

const StyledContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: ${space(2)};
  max-width: 600px;
  margin: 0 auto;
  margin-top: 10%;
`;

const StyledHeader = styled('h3')`
  margin-bottom: ${space(2)};
  width: 100%;
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
