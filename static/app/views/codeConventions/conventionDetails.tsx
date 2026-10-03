import {Fragment, useEffect} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {CodeBlock} from '@sentry/scraps/code';
import {DrawerBody, DrawerHeader, useDrawer} from '@sentry/scraps/drawer';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  conventionFilesQueryOptions,
  formatConventionTitle,
  getCodeConventionsPath,
  getConventionFileUrls,
  getConventionName,
} from 'sentry/views/codeConventions/utils';

/**
 * Route component for `code-conventions/:conventionName/`. It renders only the
 * document title; it keeps the drawer open for as long as the URL points at a
 * convention, so the drawer is linkable and closes on back navigation.
 */
export default function ConventionDetails() {
  const {conventionName} = useParams<{conventionName: string}>();
  const {query} = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const {openDrawer} = useDrawer();
  const title = formatConventionTitle(conventionName);

  // The URL only carries the convention name, and the file may end in either
  // `.yml` or `.yaml`, so look the filename up in the (already cached) list.
  const filesQuery = useQuery(conventionFilesQueryOptions);
  const filename = filesQuery.data?.find(
    entry => getConventionName(entry.name) === conventionName
  )?.name;

  const yamlQuery = useQuery({
    queryKey: ['github-raw', filename],
    queryFn: filename
      ? async ({signal}): Promise<string> => {
          const response = await fetch(getConventionFileUrls(filename).rawUrl, {signal});
          if (!response.ok) {
            throw new Error(`GitHub responded with ${response.status}`);
          }
          return response.text();
        }
      : skipToken,
    staleTime: 5 * 60 * 1000,
  });

  const isPending =
    filesQuery.isPending || (filename !== undefined && yamlQuery.isPending);
  const isError = filesQuery.isError || yamlQuery.isError;
  const isNotFound = filesQuery.isSuccess && filename === undefined;
  const yaml = yamlQuery.data;
  const refetchFiles = filesQuery.refetch;
  const refetchYaml = yamlQuery.refetch;

  useEffect(() => {
    openDrawer(
      () => (
        <Fragment>
          <DrawerHeader>
            {filename ? (
              <ExternalLink href={getConventionFileUrls(filename).htmlUrl}>
                <Text>{title}</Text>
              </ExternalLink>
            ) : (
              <Text>{title}</Text>
            )}
          </DrawerHeader>
          <DrawerBody>
            {isPending && <LoadingIndicator />}
            {isError && (
              <LoadingError
                onRetry={() => {
                  refetchFiles();
                  refetchYaml();
                }}
              />
            )}
            {isNotFound && (
              <Alert variant="warning">{t('This convention could not be found.')}</Alert>
            )}
            {filename && yaml !== undefined && (
              <CodeBlock language="yaml" filename={filename}>
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
          !nextLocation.pathname.endsWith(`/code-conventions/${conventionName}/`),
      }
    );
  }, [
    conventionName,
    filename,
    title,
    isError,
    isNotFound,
    isPending,
    navigate,
    openDrawer,
    organization.slug,
    query,
    refetchFiles,
    refetchYaml,
    yaml,
  ]);

  return (
    <SentryDocumentTitle
      title={`${title} — ${t('Code Conventions')}`}
      orgSlug={organization.slug}
    />
  );
}
