import React, {Fragment} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import TimeSince from 'sentry/components/timeSince';
import {IconCheckmark, IconCommit} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {
  formattedDownloadSize,
  formattedInstallSize,
  getPlatformIconFromPlatform,
} from 'sentry/views/preprod/utils/labelUtils';

interface PreprodBuildsTableProps {
  builds: BuildDetailsApiResponse[];
  isLoading: boolean;
  organizationSlug: string;
  projectSlug: string;
  error?: boolean;
  hasSearchQuery?: boolean;
  pageLinks?: string | null;
}

export function PreprodBuildsTable({
  builds,
  isLoading,
  error,
  pageLinks,
  organizationSlug,
  projectSlug,
  hasSearchQuery,
}: PreprodBuildsTableProps) {
  const header = (
    <SimpleTable.Header>
      <SimpleTable.HeaderCell>{t('App')}</SimpleTable.HeaderCell>
      <SimpleTable.HeaderCell>{t('Build')}</SimpleTable.HeaderCell>
      <SimpleTable.HeaderCell>{t('Install Size')}</SimpleTable.HeaderCell>
      <SimpleTable.HeaderCell>{t('Download Size')}</SimpleTable.HeaderCell>
      <SimpleTable.HeaderCell>{t('Created')}</SimpleTable.HeaderCell>
    </SimpleTable.Header>
  );

  const renderBuildRow = (build: BuildDetailsApiResponse) => {
    const linkUrl = `/organizations/${organizationSlug}/preprod/${projectSlug}/${build.id}`;

    return (
      <SimpleTable.Row key={build.id}>
        <FullRowLink to={linkUrl}>
          <InteractionStateLayer />
          <SimpleTable.RowCell justify="flex-start">
            {build.app_info?.name || build.app_info?.app_id ? (
              <Flex direction="column" gap="xs">
                <Flex align="center" gap="sm">
                  {build.app_info?.platform && (
                    <PlatformIcon
                      platform={getPlatformIconFromPlatform(build.app_info.platform)}
                    />
                  )}
                  <Text size="lg" bold>
                    {build.app_info?.name || '--'}
                  </Text>
                </Flex>
                <Text size="sm" variant="muted">
                  {build.app_info?.app_id || '--'}
                </Text>
              </Flex>
            ) : null}
          </SimpleTable.RowCell>

          <SimpleTable.RowCell justify="flex-start">
            <Flex direction="column" gap="xs">
              <Flex align="center" gap="xs">
                {build.app_info?.version !== null && (
                  <Text size="lg" bold>
                    {build.app_info?.version}
                  </Text>
                )}
                {build.app_info?.build_number !== null && (
                  <Text size="lg" variant="muted">
                    ({build.app_info?.build_number})
                  </Text>
                )}
                {build.state === 3 && <IconCheckmark size="sm" color="green300" />}
              </Flex>
              <Flex align="center" gap="xs">
                <IconCommit size="xs" />
                <Text size="sm" variant="muted" monospace>
                  #{(build.vcs_info?.head_sha?.slice(0, 7) || '--').toUpperCase()}
                </Text>
                {build.vcs_info?.head_ref !== null && (
                  <React.Fragment>
                    <Text size="sm" variant="muted">
                      –
                    </Text>
                    <Text size="sm" variant="muted">
                      {build.vcs_info?.head_ref || '--'}
                    </Text>
                  </React.Fragment>
                )}
              </Flex>
            </Flex>
          </SimpleTable.RowCell>

          <SimpleTable.RowCell>
            <Text>{formattedInstallSize(build)}</Text>
          </SimpleTable.RowCell>

          <SimpleTable.RowCell>
            <Text>{formattedDownloadSize(build)}</Text>
          </SimpleTable.RowCell>

          <SimpleTable.RowCell>
            {build.app_info?.date_added ? (
              <TimeSince date={build.app_info.date_added} unitStyle="short" />
            ) : (
              '-'
            )}
          </SimpleTable.RowCell>
        </FullRowLink>
      </SimpleTable.Row>
    );
  };

  let tableContent = null;
  if (isLoading) {
    tableContent = (
      <SimpleTable.Empty>
        <LoadingIndicator />
      </SimpleTable.Empty>
    );
  } else if (error) {
    tableContent = <SimpleTable.Empty>{t('Error loading builds')}</SimpleTable.Empty>;
  } else if (builds.length === 0) {
    tableContent = (
      <SimpleTable.Empty>
        <Text as="p">
          {hasSearchQuery
            ? t('No builds found for your search')
            : t('There are no preprod builds associated with this project.')}
        </Text>
      </SimpleTable.Empty>
    );
  } else {
    tableContent = <Fragment>{builds.map(renderBuildRow)}</Fragment>;
  }

  return (
    <Fragment>
      <SimpleTableWithColumns>
        {header}
        {tableContent}
      </SimpleTableWithColumns>
      {pageLinks && <Pagination pageLinks={pageLinks} />}
    </Fragment>
  );
}

const SimpleTableWithColumns = styled(SimpleTable)`
  overflow-x: auto;
  overflow-y: auto;
  grid-template-columns:
    minmax(250px, 2fr) minmax(250px, 2fr) minmax(100px, 1fr) minmax(100px, 1fr)
    minmax(80px, 120px);
`;

const FullRowLink = styled(Link)`
  display: contents;
  cursor: pointer;
  color: inherit;

  &:hover {
    color: inherit;
  }
`;
