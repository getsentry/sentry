import {Fragment, useCallback, useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import type {SelectKey} from 'sentry/components/core/compactSelect';
import GlobalModal from 'sentry/components/globalModal';
import {IconLightning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';

type Props = {
  handleSubmit: (e: React.MouseEvent) => void;
  hasSCMMultiOrg: boolean;
  installationID: SelectKey;
  isSaving: boolean;
  subscription: Subscription;
};

function GithubInstallationSelectInstallButton({
  hasSCMMultiOrg,
  installationID,
  subscription,
  handleSubmit,
  isSaving,
}: Props) {
  const organization = useOrganization();
  const source = 'github.multi_org';
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const handleModalClose = useCallback(() => {
    mainContainerRef.current?.focus?.();
  }, []);

  if (installationID === '-1' || hasSCMMultiOrg) {
    return (
      <StyledButton onClick={handleSubmit} disabled={isSaving || !installationID}>
        {t('Install')}
      </StyledButton>
    );
  }

  return (
    <Fragment>
      <GlobalModal onClose={handleModalClose} />
      <StyledButton
        icon={<IconLightning />}
        priority="primary"
        onClick={() => {
          trackAnalytics(`${source}.upsell`, {
            organization,
            subscriptionTier: subscription.planTier,
          });
          openUpsellModal({source, organization});
        }}
        disabled={isSaving || !installationID}
      >
        {t('Upgrade')}
      </StyledButton>
    </Fragment>
  );
}

const StyledButton = styled(Button)`
  margin-left: ${space(0.75)};
  &:not(:disabled) {
    background-color: #6c5fc7;
    color: #fff;
  }
`;

export default withSubscription(GithubInstallationSelectInstallButton);
