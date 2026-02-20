import {useEffect, useRef, useState} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {Flex, Grid} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addLoadingMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {fetchOrganizations} from 'sentry/actionCreators/organizations';
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
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {ConfirmAccountClose} from 'sentry/views/settings/account/confirmAccountClose';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

const BYE_URL = '/';
const leaveRedirect = () => (window.location.href = BYE_URL);

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
  const leaveRedirectTimeout = useRef<number | undefined>(undefined);

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

  useEffect(() => {
    return () => {
      window.clearTimeout(leaveRedirectTimeout.current);
    };
  }, []);

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

  const {mutate: removeAccount} = useMutation({
    mutationFn: (orgs: string[]) =>
      fetchMutation({
        method: 'DELETE',
        url: '/users/me/',
        data: {organizations: orgs},
      }),
    onMutate: () => {
      addLoadingMessage('Closing account\u2026');
    },
    onSuccess: () => {
      requestAnimationFrame(() => {
        openModal(GoodbyeModalContent, {
          onClose: leaveRedirect,
        });
      });
      // Redirect after 10 seconds
      window.clearTimeout(leaveRedirectTimeout.current);
      leaveRedirectTimeout.current = window.setTimeout(leaveRedirect, 10000);
    },
    onError: () => {
      addErrorMessage('Error closing account');
    },
  });

  const handleRemoveAccount = () => {
    removeAccount(Array.from(orgsToRemove));
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
          'This will permanently remove all associated data for your user. Any specified organizations will also be deleted. '
        )}
        <strong>{t('Closing your account is permanent and cannot be undone')}!</strong>
      </TextBlock>

      <Panel>
        <PanelHeader>{t('Delete the following organizations')}</PanelHeader>
        <PanelBody>
          <PanelAlert variant="warning">
            {t(
              `Organizations with checked boxes will be deleted. Boxes which can't be unchecked mean that you are the only organization owner and the organization will be deleted. If an organization is not deleted, its ownership will persist among other organization owners.`
            )}
          </PanelAlert>

          {organizations?.map(({organization, singleOwner}) => (
            <PanelItem key={organization.slug}>
              <Grid
                as="label"
                align="center"
                gap="lg"
                columns="1fr auto"
                width="100%"
                htmlFor={`delete-organization-${organization.slug}`}
              >
                <Text size="sm" bold ellipsis>
                  {organization.slug}
                </Text>
                <Switch
                  size="sm"
                  id={`delete-organization-${organization.slug}`}
                  checked={orgsToRemove.has(organization.slug)}
                  value={organization.slug}
                  onChange={evt => handleChange(organization, singleOwner, evt)}
                  disabled={singleOwner}
                />
              </Grid>
            </PanelItem>
          ))}
        </PanelBody>
      </Panel>
      <Flex justify="end">
        <HookedCustomConfirmAccountClose
          handleRemoveAccount={handleRemoveAccount}
          organizationSlugs={Array.from(orgsToRemove)}
        />
      </Flex>
    </div>
  );
}

export default AccountClose;
