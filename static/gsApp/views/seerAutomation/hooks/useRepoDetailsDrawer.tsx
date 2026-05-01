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
import {useRepositoryWithSettings} from 'sentry/components/repositories/useRepositoryWithSettings';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocationQuery} from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

import {RepoDetailsForm} from 'getsentry/views/seerAutomation/components/repoDetails/repoDetailsForm';
import {orgHasCodeReviewFeature} from 'getsentry/views/seerAutomation/utils';

export function useRepoDetailsDrawer() {
  const {repoId} = useLocationQuery({fields: {repoId: decodeScalar}});
  const organization = useOrganization();
  const {openDrawer} = useDrawer();
  const navigate = useNavigate();
  const location = useLocation();
  const isSupportedProvider = useIsSeerSupportedProvider();

  // Keep a ref so the onClose callback always sees the current query without
  // being listed as an effect dependency (which would re-open the drawer on
  // every filter/search change while the drawer is already open).
  const locationRef = useRef(location);
  useEffect(() => {
    locationRef.current = location;
  });

  const hasCodeReviewAccess = orgHasCodeReviewFeature(organization);

  const {
    data: repoWithSettings,
    error,
    isPending,
    refetch,
  } = useRepositoryWithSettings({
    repositoryId: repoId ?? '',
    enabled: !!repoId && hasCodeReviewAccess,
  });

  useEffect(() => {
    if (!repoId) return;

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
          const {repoId: _removed, ...restQuery} = locationRef.current.query;
          navigate({query: restQuery}, {replace: true});
        },
        shouldCloseOnLocationChange: nextLocation => !nextLocation.query.repoId,
      }
    );
  }, [
    repoId,
    openDrawer,
    navigate,
    organization,
    hasCodeReviewAccess,
    isSupportedProvider,
    isPending,
    error,
    refetch,
    repoWithSettings,
  ]);
}
