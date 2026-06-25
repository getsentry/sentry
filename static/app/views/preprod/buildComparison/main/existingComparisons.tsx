import {useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';
import {Pagination} from '@sentry/scraps/pagination';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocationQuery} from 'sentry/utils/url/useLocationQuery';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getMainArtifactSizeMetric,
  isSizeInfoCompleted,
  type BuildDetailsApiResponse,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import {getCompareBuildPath} from 'sentry/views/preprod/utils/buildLinkUtils';
import {comparisonListApiOptions} from 'sentry/views/preprod/utils/comparisonListApiOptions';

import {BuildItem} from './buildItem';

interface ExistingComparisonsProps {
  headBuildDetails: BuildDetailsApiResponse;
  searchQuery?: string;
}

export function ExistingComparisons({
  headBuildDetails,
  searchQuery,
}: ExistingComparisonsProps) {
  const organization = useOrganization();
  const navigate = useNavigate();
  // Use a dedicated cursor param so paging this list doesn't disturb the
  // base-build picker's pagination (which owns `cursor`).
  const {comparisonsCursor} = useLocationQuery({
    fields: {comparisonsCursor: decodeScalar},
  });

  const comparisonsQuery = useQuery({
    ...comparisonListApiOptions({
      organization,
      headArtifactId: headBuildDetails.id,
      query: searchQuery,
      cursor: comparisonsCursor,
    }),
    select: selectJsonWithHeaders,
  });

  const comparisons = comparisonsQuery.data?.json ?? [];
  const pageLinks = comparisonsQuery.data?.headers.Link || null;
  const parsedLinks = pageLinks ? parseLinkHeader(pageLinks) : {};
  const hasPagination =
    parsedLinks.previous?.results === true || parsedLinks.next?.results === true;

  // The head build is fixed for this page, so resolve its primary metric once.
  const headSizeInfo = headBuildDetails.size_info;
  const headMetric = isSizeInfoCompleted(headSizeInfo)
    ? getMainArtifactSizeMetric(headSizeInfo)
    : undefined;

  return (
    <Stack gap="lg">
      <Heading as="h2">{t('Existing Comparisons')}</Heading>

      {comparisonsQuery.isLoading && <LoadingIndicator />}
      {comparisonsQuery.isError && (
        <Alert variant="danger">{t('Failed to load existing comparisons.')}</Alert>
      )}
      {comparisonsQuery.isSuccess && comparisons.length === 0 && (
        <Text variant="muted">
          {t('No comparisons have been run for this build yet.')}
        </Text>
      )}

      <Stack gap="md">
        {comparisons.map(item => {
          const baseSizeInfo = item.base_build_details.size_info;
          const baseMetric = isSizeInfoCompleted(baseSizeInfo)
            ? getMainArtifactSizeMetric(baseSizeInfo)
            : undefined;
          const installSizeDelta =
            headMetric && baseMetric
              ? headMetric.install_size_bytes - baseMetric.install_size_bytes
              : undefined;
          const downloadSizeDelta =
            headMetric && baseMetric
              ? headMetric.download_size_bytes - baseMetric.download_size_bytes
              : undefined;

          return (
            <BuildItem
              key={item.base_build_details.id}
              build={item.base_build_details}
              to={getCompareBuildPath({
                organizationSlug: organization.slug,
                headArtifactId: headBuildDetails.id,
                baseArtifactId: item.base_build_details.id,
              })}
              installSizeDelta={installSizeDelta}
              downloadSizeDelta={downloadSizeDelta}
            />
          );
        })}

        {hasPagination && (
          <Pagination
            pageLinks={pageLinks}
            onCursor={(cursor, path, query) =>
              navigate({
                pathname: path,
                query: {...query, comparisonsCursor: cursor},
              })
            }
          />
        )}
      </Stack>
    </Stack>
  );
}
