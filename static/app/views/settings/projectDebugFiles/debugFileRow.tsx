import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Access} from 'sentry/components/acl/access';
import {useRole} from 'sentry/components/acl/useRole';
import {Confirm} from 'sentry/components/confirm';
import {FileSize} from 'sentry/components/fileSize';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {IconClock, IconDelete, IconDownload} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {DebugFile} from 'sentry/types/debugFiles';
import type {DetailedProject} from 'sentry/types/project';

import {getFeatureTooltip, getPrettyFileType} from './utils';

type Props = {
  debugFile: DebugFile;
  downloadUrl: string;
  onDelete: (id: string) => void;
  orgSlug: string;
  project: DetailedProject;
  showDetails: boolean;
};

export function DebugFileRow({
  debugFile,
  showDetails,
  downloadUrl,
  onDelete,
  orgSlug,
  project,
}: Props) {
  const {hasRole, roleRequired: downloadRole} = useRole({
    role: 'debugFilesRole',
    project,
  });
  const {id, data, debugId, uuid, size, dateCreated, objectName, symbolType, codeId} =
    debugFile;
  const {features} = data || {};

  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell align="start">
        <Stack align="stretch" width="100%">
          <div>
            <DebugId>{debugId || uuid}</DebugId>
          </div>
          <Text as="div" size="sm" variant="muted">
            <Flex
              direction={{zero: 'column', md: 'row'}}
              align={{zero: 'start', md: 'center'}}
              gap={{zero: 'xs', md: 'md'}}
              marginTop="md"
              width="100%"
            >
              <StyledFileSize bytes={size} />
              <Grid
                columns="min-content 1fr"
                flex={1}
                align="center"
                gap="xs"
                paddingLeft="xs"
              >
                <IconClock size="xs" />
                <TimeSince date={dateCreated} />
              </Grid>
            </Flex>
          </Text>
        </Stack>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell align="start">
        <Stack align="start">
          <Name>
            {symbolType === 'proguard' && objectName === 'proguard-mapping'
              ? '\u2015'
              : objectName}
          </Name>
          <Text as="div" size="sm" variant="muted">
            <Flex align="center" gap={{zero: 'md', '4xl': '0 md'}} wrap="wrap">
              <Text as="span" size="sm" variant="muted">
                {getPrettyFileType(debugFile)}
              </Text>
              {features && (
                <Flex display="inline-flex" wrap="wrap" gap="xs">
                  {features.map(feature => (
                    <Tooltip key={feature} title={getFeatureTooltip(feature)} skipWrapper>
                      <Tag variant="muted">{feature}</Tag>
                    </Tooltip>
                  ))}
                </Flex>
              )}
            </Flex>
            {showDetails && (
              <div>
                {/* there will be more stuff here in the future */}
                {codeId && (
                  <DetailsItem>
                    {t('Code ID')}: {codeId}
                  </DetailsItem>
                )}
              </div>
            )}
          </Text>
        </Stack>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end" align="start" marginTop="md">
        <Grid flow="column" align="center" gap="xs">
          <Tooltip
            disabled={hasRole}
            title={tct(
              'Debug files can only be downloaded by users with organization [downloadRole] role[orHigher]. This can be changed in [settingsLink:Debug Files Access] settings.',
              {
                downloadRole,
                orHigher: downloadRole === 'owner' ? '' : ` ${t('or higher')}`,
                settingsLink: <Link to={`/settings/${orgSlug}/#debugFilesRole`} />,
              }
            )}
            isHoverable
          >
            <LinkButton
              size="xs"
              icon={<IconDownload />}
              href={downloadUrl}
              disabled={!hasRole}
            >
              {t('Download')}
            </LinkButton>
          </Tooltip>
          <Access access={['project:write']} project={project}>
            {({hasAccess}) => (
              <Tooltip
                disabled={hasAccess}
                title={t('You do not have permission to delete debug files.')}
              >
                <Confirm
                  confirmText={t('Delete')}
                  message={t('Are you sure you wish to delete this file?')}
                  onConfirm={() => onDelete(id)}
                  disabled={!hasAccess}
                >
                  <Button
                    variant="danger"
                    icon={<IconDelete />}
                    size="xs"
                    disabled={!hasAccess}
                    data-test-id="delete-dif"
                    aria-label={t('Delete')}
                  />
                </Confirm>
              </Tooltip>
            )}
          </Access>
        </Grid>
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

const DebugId = styled('code')`
  font-size: ${p => p.theme.font.size.sm};
`;

const StyledFileSize = styled(FileSize)`
  padding-left: ${p => p.theme.space.xs};
`;

const Name = styled('div')`
  font-size: ${p => p.theme.font.size.md};
  margin-bottom: ${p => p.theme.space.md};
`;

const DetailsItem = styled('div')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: ${p => p.theme.space.md};
`;
