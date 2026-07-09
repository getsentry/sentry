import {useQuery} from '@tanstack/react-query';

import {Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
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

  const comparisonsQuery = useQuery(
    comparisonListApiOptions({
      organization,
      headArtifactId: headBuildDetails.id,
      query: searchQuery,
    })
  );

  const comparisons = comparisonsQuery.data?.comparisons ?? [];

  // Hide the section until there are comparisons (also covers the loading/error states).
  if (comparisons.length === 0) {
    return null;
  }

  // The head build is fixed for this page, so resolve its primary metric once.
  const headSizeInfo = headBuildDetails.size_info;
  const headMetric = isSizeInfoCompleted(headSizeInfo)
    ? getMainArtifactSizeMetric(headSizeInfo)
    : undefined;

  return (
    <Stack gap="lg">
      <Heading as="h2">{t('Existing Comparisons')}</Heading>

      <Stack gap="md">
        {comparisons.map(build => {
          const baseSizeInfo = build.size_info;
          const baseMetric = isSizeInfoCompleted(baseSizeInfo)
            ? getMainArtifactSizeMetric(baseSizeInfo)
            : undefined;
          const sizeDelta = (key: 'install_size_bytes' | 'download_size_bytes') =>
            headMetric && baseMetric ? headMetric[key] - baseMetric[key] : undefined;

          return (
            <BuildItem
              key={build.id}
              build={build}
              linkTo={getCompareBuildPath({
                organizationSlug: organization.slug,
                headArtifactId: headBuildDetails.id,
                baseArtifactId: build.id,
              })}
              installSizeDelta={sizeDelta('install_size_bytes')}
              downloadSizeDelta={sizeDelta('download_size_bytes')}
              onClick={() =>
                trackAnalytics('preprod.builds.compare.open_existing_comparison', {
                  organization,
                  build_id: build.id,
                  platform:
                    build.app_info?.platform ??
                    headBuildDetails.app_info?.platform ??
                    null,
                })
              }
            />
          );
        })}
      </Stack>
    </Stack>
  );
}
