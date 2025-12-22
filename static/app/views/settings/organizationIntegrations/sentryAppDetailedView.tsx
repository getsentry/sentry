import {useCallback, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {
  installSentryApp,
  uninstallSentryApp,
} from 'sentry/actionCreators/sentryAppInstallations';
import CircleIndicator from 'sentry/components/circleIndicator';
import Confirm from 'sentry/components/confirm';
import {SentryAppAvatar} from 'sentry/components/core/avatar/sentryAppAvatar';
import {Button} from 'sentry/components/core/button';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconSubtract} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  IntegrationFeature,
  SentryApp,
  SentryAppInstallation,
} from 'sentry/types/integrations';
import {toPermissions} from 'sentry/utils/consolidatedScopes';
import {
  getSentryAppInstallStatus,
  trackIntegrationAnalytics,
} from 'sentry/utils/integrationUtil';
import {
  setApiQueryData,
  useApiQuery,
  useQueryClient,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';
import {addQueryParamsToExistingUrl} from 'sentry/utils/queryString';
import {recordInteraction} from 'sentry/utils/recordSentryAppInteraction';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {IntegrationTab} from 'sentry/views/settings/organizationIntegrations/detailedView/integrationLayout';
import IntegrationLayout from 'sentry/views/settings/organizationIntegrations/detailedView/integrationLayout';
import RequestIntegrationButton from 'sentry/views/settings/organizationIntegrations/integrationRequest/RequestIntegrationButton';
import {SplitInstallationIdModal} from 'sentry/views/settings/organizationIntegrations/SplitInstallationIdModal';

function makeSentryAppInstallationsQueryKey({orgSlug}: {orgSlug: string}): ApiQueryKey {
  return [`/organizations/${orgSlug}/sentry-app-installations/`];
}

export default function SentryAppDetailedView() {
  const tabs: IntegrationTab[] = ['overview'];
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const organization = useOrganization();
  const {integrationSlug} = useParams<{integrationSlug: string}>();

  const {
    data: sentryApp,
    isPending: isSentryAppPending,
    isError: isSentryAppError,
  } = useApiQuery<SentryApp>([`/sentry-apps/${integrationSlug}/`], {
    staleTime: Infinity,
    retry: false,
  });

  const {
    data: featureData = [],
    isPending: isFeatureDataPending,
    isError: isFeatureDataError,
  } = useApiQuery<IntegrationFeature[]>([`/sentry-apps/${integrationSlug}/features/`], {
    staleTime: Infinity,
    retry: false,
  });

  const {
    data: appInstalls = [],
    isPending: isAppInstallsPending,
    isError: isAppInstallsError,
  } = useApiQuery<SentryAppInstallation[]>(
    makeSentryAppInstallationsQueryKey({orgSlug: organization.slug}),
    {
      staleTime: Infinity,
      retry: false,
    }
  );

  const integrationType = 'sentry_app';
  const integrationName = sentryApp?.name ?? '';
  const description = sentryApp?.overview || '';
  const author = sentryApp?.author || '';
  const resourceLinks = useMemo(() => {
    if (sentryApp?.status !== 'published') {
      return [];
    }
    return [
      {
        title: 'Documentation',
        url: `https://docs.sentry.io/product/integrations/${integrationSlug}/`,
      },
    ];
  }, [sentryApp?.status, integrationSlug]);

  const install = useMemo(
    () => appInstalls.find(i => i.app.slug === sentryApp?.slug),
    [appInstalls, sentryApp?.slug]
  );

  const permissions = useMemo(
    () => toPermissions(sentryApp?.scopes || []),
    [sentryApp?.scopes]
  );
  const installationStatus = useMemo(() => getSentryAppInstallStatus(install), [install]);
  const isPending = isSentryAppPending || isFeatureDataPending || isAppInstallsPending;
  const isError = isSentryAppError || isFeatureDataError || isAppInstallsError;

  useEffect(() => {
    if (sentryApp?.status === 'internal') {
      navigate(`/settings/${organization.slug}/developer-settings/${integrationSlug}/`);
    }
  }, [sentryApp?.status, navigate, organization.slug, integrationSlug]);

  useEffect(() => {
    recordInteraction(integrationSlug, 'sentry_app_viewed');
    trackIntegrationAnalytics('integrations.integration_viewed', {
      view: 'integrations_directory_integration_detail',
      integration: integrationSlug,
      integration_type: integrationType,
      already_installed: installationStatus !== 'Not Installed',
      organization,
      integration_tab: 'overview',
    });
  }, [sentryApp?.status, installationStatus, organization, integrationSlug]);

  const redirectUser = useCallback(
    (i: SentryAppInstallation) => {
      const queryParams = {
        installationId: i.uuid,
        code: i.code,
        orgSlug: organization.slug,
      };
      if (sentryApp?.redirectUrl) {
        const redirectUrl = addQueryParamsToExistingUrl(
          sentryApp.redirectUrl,
          queryParams
        );
        testableWindowLocation.assign(redirectUrl);
      }
    },
    [organization, sentryApp]
  );

  const handleInstall = useCallback(async () => {
    if (!sentryApp) {
      return;
    }
    trackIntegrationAnalytics('integrations.installation_start', {
      view: 'integrations_directory_integration_detail',
      integration: integrationSlug,
      integration_type: integrationType,
      already_installed: installationStatus !== 'Not Installed',
      organization,
      integration_status: sentryApp.status,
    });

    // installSentryApp adds a message on failure
    const newInstall = await installSentryApp(api, organization.slug, sentryApp);

    // installation is complete if the status is installed
    if (newInstall.status === 'installed') {
      trackIntegrationAnalytics('integrations.installation_complete', {
        view: 'integrations_directory_integration_detail',
        integration: integrationSlug,
        integration_type: integrationType,
        already_installed: installationStatus !== 'Not Installed',
        organization,
        integration_status: sentryApp.status,
      });
    }

    if (sentryApp.redirectUrl) {
      redirectUser(newInstall);
    } else {
      addSuccessMessage(t('%s successfully installed.', sentryApp.slug));
      setApiQueryData<SentryAppInstallation[]>(
        queryClient,
        makeSentryAppInstallationsQueryKey({orgSlug: organization.slug}),
        (existingData = []) => [newInstall, ...existingData]
      );

      // hack for split so we can show the install ID to users for them to copy
      // Will remove once the proper fix is in place
      if (['split', 'split-dev', 'split-testing'].includes(sentryApp.slug)) {
        openModal(({closeModal}) => (
          <SplitInstallationIdModal
            installationId={newInstall.uuid}
            closeModal={closeModal}
          />
        ));
      }
    }
  }, [
    api,
    organization,
    sentryApp,
    queryClient,
    installationStatus,
    integrationSlug,
    redirectUser,
  ]);

  const handleUninstall = useCallback(
    async (outgoingInstall: SentryAppInstallation) => {
      if (!sentryApp) {
        return;
      }

      try {
        await uninstallSentryApp(api, outgoingInstall);
        trackIntegrationAnalytics('integrations.uninstall_completed', {
          view: 'integrations_directory_integration_detail',
          integration: integrationSlug,
          integration_type: integrationType,
          already_installed: installationStatus !== 'Not Installed',
          organization,
          integration_status: sentryApp.status,
        });
        setApiQueryData<SentryAppInstallation[]>(
          queryClient,
          makeSentryAppInstallationsQueryKey({orgSlug: organization.slug}),
          (existingData = []) =>
            existingData.map(i =>
              i.app.slug === sentryApp.slug ? {...i, status: 'pending_deletion'} : i
            )
        );
      } catch (error) {
        addErrorMessage(t('Unable to uninstall %s', sentryApp.name));
      }
    },
    [
      api,
      sentryApp,
      queryClient,
      organization,
      integrationSlug,
      integrationType,
      installationStatus,
    ]
  );

  const recordUninstallClicked = useCallback(() => {
    trackIntegrationAnalytics('integrations.uninstall_clicked', {
      view: 'integrations_directory_integration_detail',
      integration: integrationSlug,
      integration_type: integrationType,
      organization,
      integration_status: sentryApp?.status,
    });
  }, [integrationSlug, integrationType, organization, sentryApp?.status]);

  const renderPermissions = useCallback(() => {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    if (!Object.keys(permissions).some(scope => permissions[scope].length > 0)) {
      return null;
    }
    return (
      <PermissionWrapper>
        <Title>{t('Permissions')}</Title>
        {permissions.read.length > 0 && (
          <Permission>
            <Indicator />
            <Text key="read">
              {tct('[read] access to [resources] resources', {
                read: <strong>Read</strong>,
                resources: permissions.read.join(', '),
              })}
            </Text>
          </Permission>
        )}
        {permissions.write.length > 0 && (
          <Permission>
            <Indicator />
            <Text key="write">
              {tct('[read] and [write] access to [resources] resources', {
                read: <strong>Read</strong>,
                write: <strong>Write</strong>,
                resources: permissions.write.join(', '),
              })}
            </Text>
          </Permission>
        )}
        {permissions.admin.length > 0 && (
          <Permission>
            <Indicator />
            <Text key="admin">
              {tct('[admin] access to [resources] resources', {
                admin: <strong>Admin</strong>,
                resources: permissions.admin.join(', '),
              })}
            </Text>
          </Permission>
        )}
      </PermissionWrapper>
    );
  }, [permissions]);

  const renderTopButton = useCallback(
    (disabledFromFeatures: boolean, userHasAccess: boolean) => {
      const capitalizedSlug =
        integrationSlug.charAt(0).toUpperCase() + integrationSlug.slice(1);
      if (install?.status === 'pending_deletion') {
        return (
          <StyledButton size="sm" disabled>
            {t('Pending Deletion')}
          </StyledButton>
        );
      }
      if (install) {
        return (
          <Confirm
            disabled={!userHasAccess}
            message={tct('Are you sure you want to uninstall the [slug] installation?', {
              slug: capitalizedSlug,
            })}
            onConfirm={() => handleUninstall(install)} // called when the user confirms the action
            onConfirming={recordUninstallClicked} // called when the confirm modal opens
            priority="danger"
          >
            <StyledButton size="sm" data-test-id="sentry-app-uninstall">
              <IconSubtract style={{marginRight: space(0.75)}} />
              {t('Uninstall')}
            </StyledButton>
          </Confirm>
        );
      }

      if (userHasAccess) {
        // TODO: @sentaur-athena: Remove hardcoded github-deployment-gates after deleting the code
        return (
          <InstallButton
            data-test-id="install-button"
            disabled={
              disabledFromFeatures || integrationSlug === 'github-deployment-gates'
            }
            onClick={() => handleInstall()}
            priority="primary"
            size="sm"
            style={{marginLeft: space(1)}}
          >
            {t('Accept & Install')}
          </InstallButton>
        );
      }
      return (
        <RequestIntegrationButton
          name={integrationName}
          slug={integrationSlug}
          type={integrationType}
        />
      );
    },
    [
      handleInstall,
      handleUninstall,
      integrationName,
      integrationSlug,
      integrationType,
      install,
      recordUninstallClicked,
    ]
  );

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError || !sentryApp) {
    return <LoadingError message={t('There was an error loading this integration.')} />;
  }

  return (
    <IntegrationLayout.Body
      integrationName={integrationName}
      alert={null}
      topSection={
        <IntegrationLayout.TopSection
          featureData={featureData}
          integrationName={integrationName}
          installationStatus={installationStatus}
          integrationIcon={<SentryAppAvatar sentryApp={sentryApp} size={50} />}
          addInstallButton={
            <IntegrationLayout.AddInstallButton
              featureData={featureData}
              hideButtonIfDisabled={false}
              requiresAccess
              renderTopButton={renderTopButton}
            />
          }
          additionalCTA={null}
        />
      }
      tabs={<IntegrationLayout.Tabs tabs={tabs} activeTab="overview" />}
      content={
        <IntegrationLayout.InformationCard
          integrationSlug={integrationSlug}
          description={description}
          featureData={featureData}
          author={author}
          resourceLinks={resourceLinks}
          permissions={renderPermissions()}
        />
      }
    />
  );
}

const Text = styled('p')`
  margin: 0px 6px;
`;

const Permission = styled('div')`
  display: flex;
`;

const PermissionWrapper = styled('div')`
  padding-bottom: ${space(2)};
`;

const Title = styled('p')`
  margin-bottom: ${space(1)};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const Indicator = styled((p: any) => <CircleIndicator size={7} {...p} />)`
  align-self: center;
  color: ${p => p.theme.success};
`;

const InstallButton = styled(Button)`
  margin-left: ${space(1)};
`;

const StyledButton = styled(Button)`
  color: ${p => p.theme.subText};
  background: ${p => p.theme.tokens.background.primary};

  border: ${p => `1px solid ${p.theme.colors.gray400}`};
  box-sizing: border-box;
  box-shadow: 0px 2px 1px rgba(0, 0, 0, 0.08);
  border-radius: 4px;
`;
