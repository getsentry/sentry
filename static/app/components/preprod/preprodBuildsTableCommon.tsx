import {Fragment} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Button} from '@sentry/scraps/button';

import Feature from 'sentry/components/acl/feature';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Container, Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import TimeSince from 'sentry/components/timeSince';
import {IconCheckmark, IconCommit, IconNot} from 'sentry/icons';
import {t} from 'sentry/locale';
import {InstallAppButton} from 'sentry/views/preprod/components/installAppButton';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {getPlatformIconFromPlatform} from 'sentry/views/preprod/utils/labelUtils';

export function PreprodBuildsHeaderCells({
  showProjectColumn,
}: {
  showProjectColumn: boolean;
}) {
  return (
    <Fragment>
      <SimpleTable.HeaderCell>{t('App')}</SimpleTable.HeaderCell>
      {showProjectColumn && (
        <SimpleTable.HeaderCell>{t('Project')}</SimpleTable.HeaderCell>
      )}
      <SimpleTable.HeaderCell>{t('Build')}</SimpleTable.HeaderCell>
    </Fragment>
  );
}

export function PreprodBuildsCreatedHeaderCell() {
  return <SimpleTable.HeaderCell>{t('Created')}</SimpleTable.HeaderCell>;
}

interface PreprodBuildsRowCellsProps {
  build: BuildDetailsApiResponse;
  showInteraction: boolean;
  showProjectColumn: boolean;
  showInstallabilityIndicator?: boolean;
}

export function PreprodBuildsRowCells({
  build,
  showInteraction,
  showProjectColumn,
  showInstallabilityIndicator = false,
}: PreprodBuildsRowCellsProps) {
  return (
    <Fragment>
      {showInteraction && <InteractionStateLayer />}
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
                {(build.distribution_info?.is_installable ||
                  showInstallabilityIndicator) && (
                  <Flex align="center">
                    {build.distribution_info?.is_installable ? (
                      <InstallAppButton
                        projectId={build.project_slug}
                        artifactId={build.id}
                        platform={build.app_info.platform ?? null}
                        source="builds_table"
                        variant="icon"
                      />
                    ) : (
                      <Tooltip title={t('Not installable')} skipWrapper>
                        <span>
                          <Button
                            aria-label={t('Not installable')}
                            icon={<IconNot color="red300" size="xs" />}
                            priority="transparent"
                            size="zero"
                            disabled
                          />
                        </span>
                      </Tooltip>
                    )}
                  </Flex>
                )}
              </Feature>
            </Flex>
            <Flex align="center" gap="xs">
              <Text size="sm" variant="muted">
                {build.app_info?.app_id || '--'}
              </Text>
              {build.app_info?.build_configuration && (
                <Fragment>
                  <Text size="sm" variant="muted">
                    {' • '}
                  </Text>
                  <Tooltip title={t('Build configuration')}>
                    <Text size="sm" variant="muted" monospace>
                      {build.app_info.build_configuration}
                    </Text>
                  </Tooltip>
                </Fragment>
              )}
            </Flex>
          </Flex>
        ) : null}
      </SimpleTable.RowCell>

      {showProjectColumn && (
        <SimpleTable.RowCell justify="start">
          <Text>{build.project_slug}</Text>
        </SimpleTable.RowCell>
      )}

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
              <Fragment>
                <Text size="sm" variant="muted">
                  #{build.vcs_info?.pr_number}
                </Text>
              </Fragment>
            )}
            {build.vcs_info?.head_ref !== null && (
              <Fragment>
                <Text size="sm" variant="muted">
                  –
                </Text>
                <Text size="sm" variant="muted">
                  {build.vcs_info?.head_ref || '--'}
                </Text>
              </Fragment>
            )}
          </Flex>
        </Flex>
      </SimpleTable.RowCell>
    </Fragment>
  );
}

export function PreprodBuildsCreatedRowCell({build}: {build: BuildDetailsApiResponse}) {
  return (
    <SimpleTable.RowCell>
      {build.app_info?.date_added ? (
        <TimeSince date={build.app_info.date_added} unitStyle="short" />
      ) : (
        '-'
      )}
    </SimpleTable.RowCell>
  );
}

export const FullRowLink = styled(Link)`
  display: contents;
  cursor: pointer;
  color: inherit;

  &:hover {
    color: inherit;
  }
`;
