import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import type {SelectKey} from 'sentry/components/core/compactSelect';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconLightning} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';

type Props = {
  handleSubmit: (e: React.MouseEvent) => void;
  has_scm_multi_org: boolean;
  installationID: SelectKey;
  isSaving: boolean;
  subscription: Subscription;
};

function GithubInstallationSelectInstallButton({
  has_scm_multi_org,
  installationID,
  subscription,
  handleSubmit,
  isSaving,
}: Props) {
  const isSelfHosted = ConfigStore.get('isSelfHosted');
  const org = useOrganization();
  const source = 'github.multi_org';

  if (installationID === '-1' || has_scm_multi_org) {
    return (
      <StyledButton onClick={handleSubmit} disabled={isSaving || !installationID}>
        {t('Install')}
      </StyledButton>
    );
  }

  if (isSelfHosted) {
    return (
      <Tooltip
        title={t('Please check your configuration, scm-multi-org feature is not enabled')}
      >
        <StyledButton disabled>{t('Install')}</StyledButton>;
      </Tooltip>
    );
  }

  return (
    <StyledButton
      onClick={() => {
        trackAnalytics(`${source}.upsell`, {
          organization: org,
          subscription: subscription.planTier,
        });
        openUpsellModal({source, organization: org});
      }}
      disabled={isSaving || !installationID || isSelfHosted}
    >
      <ButtonContent>
        <Fragment>
          <IconLightning />
          {t('Upgrade')}
        </Fragment>
      </ButtonContent>
    </StyledButton>
  );
}

const StyledButton = styled(Button)`
  margin-left: ${space(0.75)};
  &:not(:disabled) {
    background-color: #6c5fc7;
    color: #fff;
  }
`;

const ButtonContent = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
export default withSubscription(GithubInstallationSelectInstallButton);
