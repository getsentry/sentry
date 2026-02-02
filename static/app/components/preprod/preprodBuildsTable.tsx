import React, {Fragment, useMemo} from 'react';

import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct} from 'sentry/locale';
import type RequestError from 'sentry/utils/requestError/requestError';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {getLabels} from 'sentry/views/preprod/utils/labelUtils';

import {PreprodBuildsDisplay} from './preprodBuildsDisplay';
import {PreprodBuildsDistributionTable} from './preprodBuildsDistributionTable';
import {PreprodBuildsSizeTable} from './preprodBuildsSizeTable';

interface PreprodBuildsTableProps {
  builds: BuildDetailsApiResponse[];
  isLoading: boolean;
  organizationSlug: string;
  display?: PreprodBuildsDisplay;
  error?: RequestError | null;
  hasSearchQuery?: boolean;
  onRowClick?: (build: BuildDetailsApiResponse) => void;
  pageLinks?: string | null;
  showProjectColumn?: boolean;
}

function getErrorMessage(error: RequestError): string {
  const detail = error.responseJSON?.detail;
  if (typeof detail === 'string') {
    return detail;
  }
  if (detail?.message) {
    return detail.message;
  }
  return t('Error loading builds');
}

export function PreprodBuildsTable({
  builds,
  display = PreprodBuildsDisplay.SIZE,
  isLoading,
  error,
  pageLinks,
  onRowClick,
  organizationSlug,
  hasSearchQuery,
  showProjectColumn = false,
}: PreprodBuildsTableProps) {
  const isDistributionDisplay = display === PreprodBuildsDisplay.DISTRIBUTION;
  const emptyStateDocUrl = isDistributionDisplay
    ? 'https://docs.sentry.io/product/build-distribution/'
    : 'https://docs.sentry.io/product/size-analysis/';

  const hasMultiplePlatforms = useMemo(() => {
    const platforms = new Set(builds.map(b => b.app_info?.platform).filter(Boolean));
    return platforms.size > 1;
  }, [builds]);

  const labels = useMemo(
    () => getLabels(builds[0]?.app_info?.platform ?? undefined, hasMultiplePlatforms),
    [builds, hasMultiplePlatforms]
  );
  let tableContent: React.ReactNode | undefined;
  if (isLoading) {
    tableContent = (
      <SimpleTable.Empty>
        <LoadingIndicator />
      </SimpleTable.Empty>
    );
  } else if (error) {
    tableContent = <SimpleTable.Empty>{getErrorMessage(error)}</SimpleTable.Empty>;
  } else if (builds.length === 0) {
    tableContent = (
      <SimpleTable.Empty>
        <Text as="p">
          {hasSearchQuery
            ? t('No mobile builds found for your search')
            : tct('No mobile builds found, see our [link:documentation] for more info.', {
                link: (
                  <ExternalLink href={emptyStateDocUrl}>{t('Learn more')}</ExternalLink>
                ),
              })}
        </Text>
      </SimpleTable.Empty>
    );
  }

  return (
    <Fragment>
      {isDistributionDisplay ? (
        <PreprodBuildsDistributionTable
          builds={builds}
          content={tableContent}
          onRowClick={onRowClick}
          organizationSlug={organizationSlug}
          showProjectColumn={showProjectColumn}
        />
      ) : (
        <PreprodBuildsSizeTable
          builds={builds}
          content={tableContent}
          labels={labels}
          onRowClick={onRowClick}
          organizationSlug={organizationSlug}
          showProjectColumn={showProjectColumn}
        />
      )}
      {pageLinks && <Pagination pageLinks={pageLinks} />}
    </Fragment>
  );
}
