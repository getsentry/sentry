import {useEffect, useRef} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {DrawerBody, DrawerHeader, useDrawer} from '@sentry/scraps/drawer';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {useIsSeerSupportedProvider} from 'sentry/components/events/autofix/utils';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {NoAccess} from 'sentry/components/noAccess';
import {RepoProviderIcon} from 'sentry/components/repositories/repoProviderIcon';
import {getRepositoryWithSettingsQueryKey} from 'sentry/components/repositories/useRepositoryWithSettings';
import {t} from 'sentry/locale';
import type {RepositoryWithSettings} from 'sentry/types/integrations';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {RepoDetailsForm} from 'getsentry/views/seerAutomation/components/repoDetails/repoDetailsForm';
import {orgHasCodeReviewFeature} from 'getsentry/views/seerAutomation/utils';

export default function SeerRepoDetails() {
  const {query} = useLocation();
  const {repoId} = useParams<{repoId: string}>();
  const navigate = useNavigate();
  const organization = useOrganization();
  const {openDrawer} = useDrawer();

  const queryRef = useRef(query);
  queryRef.current = query;

  const isSupportedProvider = useIsSeerSupportedProvider();

  const hasCodeReviewAccess = orgHasCodeReviewFeature(organization);

  const {
    data: repoWithSettings,
    error,
    isPending,
    refetch,
  } = useApiQuery<RepositoryWithSettings>(
    getRepositoryWithSettingsQueryKey(organization, repoId ?? ''),
    {
      staleTime: 0,
      enabled: !!repoId && hasCodeReviewAccess,
    }
  );

  useEffect(() => {
    if (!repoId) {
      return;
    }

    openDrawer(
      () => (
        <AnalyticsArea name="repo-details">
          <DrawerHeader>
            {repoWithSettings && (
              <ExternalLink href={repoWithSettings.url}>
                <Flex align="center" gap="md" height="100%">
                  <RepoProviderIcon size="md" provider={repoWithSettings.provider.id} />
                  <Text monospace>{repoWithSettings.name}</Text>
                </Flex>
              </ExternalLink>
            )}
          </DrawerHeader>
          <DrawerBody>
            {!hasCodeReviewAccess && <NoAccess />}
            {hasCodeReviewAccess && isPending && <LoadingIndicator />}
            {hasCodeReviewAccess && error && <LoadingError onRetry={refetch} />}
            {hasCodeReviewAccess &&
              repoWithSettings &&
              (isSupportedProvider(repoWithSettings.provider) ? (
                <RepoDetailsForm
                  organization={organization}
                  repoWithSettings={repoWithSettings}
                />
              ) : (
                <Alert variant="warning">
                  {t('Seer is not supported for this repository.')}
                </Alert>
              ))}
          </DrawerBody>
        </AnalyticsArea>
      ),
      {
        ariaLabel: t('Repository Details'),
        drawerKey: 'repo-details-drawer',
        resizable: true,
        onClose: () => {
          navigate({
            pathname: `/settings/${organization.slug}/seer/repos/`,
            query: queryRef.current,
          });
        },
        shouldCloseOnLocationChange: nextLocation =>
          !nextLocation.pathname.endsWith(`/seer/repos/${repoId}/`),
      }
    );
  }, [
    error,
    hasCodeReviewAccess,
    isPending,
    isSupportedProvider,
    navigate,
    openDrawer,
    organization,
    refetch,
    repoId,
    repoWithSettings,
  ]);

  return null;
}
