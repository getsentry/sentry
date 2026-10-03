import {Fragment, useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';

import {CodeBlock} from '@sentry/scraps/code';
import {DrawerBody, DrawerHeader, useDrawer} from '@sentry/scraps/drawer';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  formatConventionTitle,
  getCodeConventionsPath,
  getConventionFileUrls,
} from 'sentry/views/codeConventions/utils';

/**
 * Route component for `code-conventions/:conventionFile/`. It renders nothing
 * itself; it keeps the drawer open for as long as the URL points at a
 * convention, so the drawer is linkable and closes on back navigation.
 */
export default function ConventionDetails() {
  const {conventionFile} = useParams<{conventionFile: string}>();
  const {query} = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const {openDrawer} = useDrawer();

  const {htmlUrl, rawUrl} = getConventionFileUrls(conventionFile);

  const {
    data: yaml,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['github-raw', rawUrl],
    queryFn: async ({signal}): Promise<string> => {
      const response = await fetch(rawUrl, {signal});
      if (!response.ok) {
        throw new Error(`GitHub responded with ${response.status}`);
      }
      return response.text();
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    openDrawer(
      () => (
        <Fragment>
          <DrawerHeader>
            <ExternalLink href={htmlUrl}>
              <Text monospace>{formatConventionTitle(conventionFile)}</Text>
            </ExternalLink>
          </DrawerHeader>
          <DrawerBody>
            {isPending && <LoadingIndicator />}
            {isError && <LoadingError onRetry={refetch} />}
            {yaml !== undefined && (
              <CodeBlock language="yaml" filename={conventionFile}>
                {yaml}
              </CodeBlock>
            )}
          </DrawerBody>
        </Fragment>
      ),
      {
        ariaLabel: t('Convention Details'),
        drawerKey: 'code-convention-details-drawer',
        resizable: true,
        onClose: () => {
          navigate({
            pathname: normalizeUrl(getCodeConventionsPath(organization.slug)),
            query,
          });
        },
        shouldCloseOnLocationChange: nextLocation =>
          !nextLocation.pathname.endsWith(`/code-conventions/${conventionFile}/`),
      }
    );
  }, [
    conventionFile,
    htmlUrl,
    isError,
    isPending,
    navigate,
    openDrawer,
    organization.slug,
    query,
    refetch,
    yaml,
  ]);

  return null;
}
