import {useEffect, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {addErrorMessage, addLoadingMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {fetchOrganizations} from 'sentry/actionCreators/organizations';
import {LinkButton} from 'sentry/components/button';
import Checkbox from 'sentry/components/checkbox';
import {Alert} from 'sentry/components/core/alert/alert';
import HookOrDefault from 'sentry/components/hookOrDefault';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelAlert from 'sentry/components/panels/panelAlert';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Organization, OrganizationSummary} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';
import {ConfirmAccountClose} from 'sentry/views/settings/account/confirmAccountClose';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

const BYE_URL = '/';
const leaveRedirect = () => (window.location.href = BYE_URL);

const Important = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
  font-size: 1.2em;
`;

function GoodbyeModalContent({Header, Body, Footer}: ModalRenderProps) {
  return (
    <div>
      <Header>{t('Closing Account')}</Header>
      <Body>
        <TextBlock>
          {t('Your account has been deactivated and scheduled for removal.')}
        </TextBlock>
        <TextBlock>
          {t('Thanks for using Sentry! We hope to see you again soon!')}
        </TextBlock>
      </Body>
      <Footer>
        <LinkButton href={BYE_URL}>{t('Goodbye')}</LinkButton>
      </Footer>
    </div>
  );
}

type OwnedOrg = {
  organization: Organization;
  singleOwner: boolean;
};

function AccountClose() {
  const api = useApi();

  const [organizations, setOrganizations] = useState<OwnedOrg[]>([]);
  const [orgsToRemove, setOrgsToRemove] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Load organizations from all regions.
  useEffect(() => {
    setIsLoading(true);
    fetchOrganizations(api, {owner: 1}).then((response: OwnedOrg[]) => {
      const singleOwnerOrgs = response
        .filter(item => item.singleOwner)
        .map(item => item.organization.slug);

      setOrgsToRemove(new Set(singleOwnerOrgs));
      setOrganizations(response);
      setIsLoading(false);
    });
  }, [api]);

  let leaveRedirectTimeout: number | undefined = undefined;
  useEffect(() => {
    // setup unmount callback
    return () => {
      window.clearTimeout(leaveRedirectTimeout);
    };
  }, [leaveRedirectTimeout]);

  const handleChange = (
    organization: OrganizationSummary,
    isSingle: boolean,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const checked = event.target.checked;

    // Can't unselect an org where you are the single owner
    if (isSingle) {
      return;
    }
    const slugSet = new Set(orgsToRemove);
    if (checked) {
      slugSet.add(organization.slug);
    } else {
      slugSet.delete(organization.slug);
    }
    setOrgsToRemove(slugSet);
  };

  const handleRemoveAccount = async () => {
    addLoadingMessage('Closing account\u2026');

    try {
      await api.requestPromise('/users/me/', {
        method: 'DELETE',
        data: {organizations: Array.from(orgsToRemove)},
      });

      openModal(GoodbyeModalContent, {
        onClose: leaveRedirect,
      });

      // Redirect after 10 seconds
      window.clearTimeout(leaveRedirectTimeout);
      leaveRedirectTimeout = window.setTimeout(leaveRedirect, 10000);
    } catch {
      addErrorMessage('Error closing account');
    }
  };

  const HookedCustomConfirmAccountClose = HookOrDefault({
    hookName: 'component:confirm-account-close',
    defaultComponent: props => <ConfirmAccountClose {...props} />,
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  return (
    <div>
      <SentryDocumentTitle title={t('Close Account')} />
      <SettingsPageHeader title={t('Close Account')} />

      <TextBlock>
        {t(
          'This will permanently remove all associated data for your user. Any specified organizations will also be deleted.'
        )}
      </TextBlock>

      <Alert.Container>
        <Alert type="error" showIcon>
          <Important>
            {t('Closing your account is permanent and cannot be undone')}!
          </Important>
        </Alert>
      </Alert.Container>

      <Panel>
        <PanelHeader>{t('Delete the following organizations')}</PanelHeader>
        <PanelBody>
          <PanelAlert type="warning">
            <strong>{t('ORGANIZATIONS WITH CHECKED BOXES WILL BE DELETED!')}</strong>
            <br />
            {t(
              'Ownership will remain with other organization owners if an organization is not deleted.'
            )}
            <br />
            {t(
              "Boxes which can't be unchecked mean that you are the only organization owner and the organization will be deleted."
            )}
          </PanelAlert>

          {organizations?.map(({organization, singleOwner}) => (
            <PanelItem key={organization.slug}>
              <PanelLabel>
                <Checkbox
                  css={css`
                    margin-right: 6px;
                  `}
                  name="organizations"
                  checked={orgsToRemove.has(organization.slug)}
                  disabled={singleOwner}
                  value={organization.slug}
                  onChange={evt => handleChange(organization, singleOwner, evt)}
                  size="sm"
                  role="checkbox"
                />
                {organization.slug}
              </PanelLabel>
            </PanelItem>
          ))}
        </PanelBody>
      </Panel>
      <HookedCustomConfirmAccountClose
        handleRemoveAccount={handleRemoveAccount}
        organizationSlugs={Array.from(orgsToRemove)}
      />
    </div>
  );
}

const PanelLabel = styled('label')`
  display: flex;
  align-items: center;
`;

export default AccountClose;
