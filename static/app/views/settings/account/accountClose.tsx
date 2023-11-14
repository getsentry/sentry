import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addLoadingMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps, openModal} from 'sentry/actionCreators/modal';
import {fetchOrganizations} from 'sentry/actionCreators/organizations';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import HookOrDefault from 'sentry/components/hookOrDefault';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelAlert from 'sentry/components/panels/panelAlert';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import {t, tct} from 'sentry/locale';
import {Organization, OrganizationSummary} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import {ConfirmAccountClose} from 'sentry/views/settings/account/confirmAccountClose';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

const BYE_URL = '/';
const leaveRedirect = () => (window.location.href = BYE_URL);

const Important = styled('div')`
  font-weight: bold;
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
        <Button href={BYE_URL}>{t('Goodbye')}</Button>
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
      <SettingsPageHeader title={t('Close Account')} />

      <TextBlock>
        {t('This will permanently remove all associated data for your user')}.
      </TextBlock>

      <Alert type="error" showIcon>
        <Important>
          {t('Closing your account is permanent and cannot be undone')}!
        </Important>
      </Alert>

      <Panel>
        <PanelHeader>{t('Remove the following organizations')}</PanelHeader>
        <PanelBody>
          <PanelAlert type="info">
            {t(
              'Ownership will remain with other organization owners if an organization is not deleted.'
            )}
            <br />
            {tct(
              "Boxes which can't be unchecked mean that you are the only organization owner and the organization [strong:will be deleted].",
              {strong: <strong />}
            )}
          </PanelAlert>

          {organizations?.map(({organization, singleOwner}) => (
            <PanelItem key={organization.slug}>
              <label>
                <input
                  style={{marginRight: 6}}
                  type="checkbox"
                  value={organization.slug}
                  onChange={evt => handleChange(organization, singleOwner, evt)}
                  name="organizations"
                  checked={orgsToRemove.has(organization.slug)}
                  disabled={singleOwner}
                />
                {organization.slug}
              </label>
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

export default AccountClose;
