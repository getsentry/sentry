import React, {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import Feature from 'sentry/components/acl/feature';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Container, Flex} from 'sentry/components/core/layout';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import TimeSince from 'sentry/components/timeSince';
import {IconCheckmark, IconCommit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {InstallAppButton} from 'sentry/views/preprod/components/installAppButton';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {
  formattedPrimaryMetricDownloadSize,
  formattedPrimaryMetricInstallSize,
  getLabels,
  getPlatformIconFromPlatform,
} from 'sentry/views/preprod/utils/labelUtils';

interface PreprodBuildsTableProps {
  builds: BuildDetailsApiResponse[];
  isLoading: boolean;
  organizationSlug: string;
  projectSlug: string;
  error?: boolean;
  hasSearchQuery?: boolean;
  onRowClick?: (build: BuildDetailsApiResponse) => void;
  pageLinks?: string | null;
}

export function PreprodBuildsTable({
  builds,
  isLoading,
  error,
  pageLinks,
  onRowClick,
  organizationSlug,
  projectSlug,
  hasSearchQuery,
}: PreprodBuildsTableProps) {
  const labels = useMemo(
    () => getLabels(builds[0]?.app_info?.platform ?? undefined),
    [builds]
  );
  const header = (
    <SimpleTable.Header>
      <SimpleTable.HeaderCell>{t('App')}</SimpleTable.HeaderCell>
      <SimpleTable.HeaderCell>{t('Build')}</SimpleTable.HeaderCell>
      <SimpleTable.HeaderCell>{labels.installSizeLabel}</SimpleTable.HeaderCell>
      <SimpleTable.HeaderCell>{labels.downloadSizeLabel}</SimpleTable.HeaderCell>
      <SimpleTable.HeaderCell>{t('Created')}</SimpleTable.HeaderCell>
    </SimpleTable.Header>
  );

  const renderBuildRow = (build: BuildDetailsApiResponse) => {
    const linkUrl = `/organizations/${organizationSlug}/preprod/${projectSlug}/${build.id}`;

    return (
      <SimpleTable.Row key={build.id}>
        <FullRowLink to={linkUrl} onClick={() => onRowClick?.(build)}>
          <InteractionStateLayer />
          <SimpleTable.RowCell justify="start">
            {build.app_info?.name || build.app_info?.app_id ? (
              <Flex direction="column" gap="xs">
                <Flex align="center" gap="2xs">
                  {build.app_info?.platform && (
                    <PlatformIcon
                      platform={getPlatformIconFromPlatform(build.app_info.platform)}
                    />
                  )}
                  <Container paddingLeft="xs">
                    <Text size="lg" bold>
                      {build.app_info?.name || '--'}
                    </Text>
                  </Container>
                  <Feature features="organizations:preprod-build-distribution">
                    {build.app_info.is_installable && (
                      <InstallAppButton
                        projectId={projectSlug}
                        artifactId={build.id}
                        platform={build.app_info.platform ?? null}
                        source="builds_table"
                        variant="icon"
                      />
                    )}
                  </Feature>
                </Flex>
                <Flex align="center" gap="xs">
                  <Text size="sm" variant="muted">
                    {build.app_info?.app_id || '--'}
                  </Text>
                  {build.app_info?.build_configuration && (
                    <React.Fragment>
                      <Text size="sm" variant="muted">
                        {' • '}
                      </Text>
                      <Tooltip title={t('Build configuration')}>
                        <Text size="sm" variant="muted" monospace>
                          {build.app_info.build_configuration}
                        </Text>
                      </Tooltip>
                    </React.Fragment>
                  )}
                </Flex>
              </Flex>
            ) : null}
          </SimpleTable.RowCell>

          <SimpleTable.RowCell justify="start">
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
                  {(build.vcs_info?.head_sha?.slice(0, 7) || '--').toUpperCase()}
                </Text>
                {build.vcs_info?.pr_number && (
                  <React.Fragment>
                    <Text size="sm" variant="muted">
                      #{build.vcs_info?.pr_number}
                    </Text>
                  </React.Fragment>
                )}
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
            <Text>{formattedPrimaryMetricInstallSize(build.size_info)}</Text>
          </SimpleTable.RowCell>

          <SimpleTable.RowCell>
            <Text>{formattedPrimaryMetricDownloadSize(build.size_info)}</Text>
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
            ? t('No mobile builds found for your search')
            : tct('No mobile builds found, see our [link:documentation] for more info.', {
                link: (
                  <ExternalLink href="https://docs.sentry.io/product/size-analysis/">
                    {t('Learn more')}
                  </ExternalLink>
                ),
              })}
        </Text>
      </SimpleTable.Empty>
    );
  } else {
    tableContent = <Fragment>{builds.map(build => renderBuildRow(build))}</Fragment>;
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
