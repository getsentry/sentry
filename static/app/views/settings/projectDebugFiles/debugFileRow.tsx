import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';

import Access from 'sentry/components/acl/access';
import {useRole} from 'sentry/components/acl/useRole';
import Confirm from 'sentry/components/confirm';
import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import FileSize from 'sentry/components/fileSize';
import TimeSince from 'sentry/components/timeSince';
import {IconClock, IconDelete, IconDownload} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DebugFile} from 'sentry/types/debugFiles';
import type {Project} from 'sentry/types/project';

import {getFeatureTooltip, getPrettyFileType} from './utils';

type Props = {
  debugFile: DebugFile;
  downloadUrl: string;
  onDelete: (id: string) => void;
  orgSlug: string;
  project: Project;
  showDetails: boolean;
};

function DebugFileRow({
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
    <Fragment>
      <Stack align="start">
        <div>
          <DebugId>{debugId || uuid}</DebugId>
        </div>
        <TimeAndSizeWrapper>
          <StyledFileSize bytes={size} />
          <TimeWrapper>
            <IconClock size="xs" />
            <TimeSince date={dateCreated} />
          </TimeWrapper>
        </TimeAndSizeWrapper>
      </Stack>
      <Stack align="start">
        <Name>
          {symbolType === 'proguard' && objectName === 'proguard-mapping'
            ? '\u2015'
            : objectName}
        </Name>
        <Description>
          <DescriptionText>{getPrettyFileType(debugFile)}</DescriptionText>

          {features && (
            <FeatureTags>
              {features.map(feature => (
                <Tooltip key={feature} title={getFeatureTooltip(feature)} skipWrapper>
                  <StyledTag variant="muted">{feature}</StyledTag>
                </Tooltip>
              ))}
            </FeatureTags>
          )}
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
        </Description>
      </Stack>
      <Flex justify="end" align="start" marginTop="md">
        <ButtonBar gap="xs">
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
                    priority="danger"
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
        </ButtonBar>
      </Flex>
    </Fragment>
  );
}

const DescriptionText = styled('span')`
  display: inline-flex;
  margin: 0 ${space(1)} ${space(1)} 0;
`;

const FeatureTags = styled('div')`
  display: inline-flex;
  flex-wrap: wrap;
  margin: -${space(0.5)};
`;

const StyledTag = styled(Tag)`
  padding: ${space(0.5)};
`;

const DebugId = styled('code')`
  font-size: ${p => p.theme.fontSize.sm};
`;

const TimeAndSizeWrapper = styled('div')`
  width: 100%;
  display: flex;
  font-size: ${p => p.theme.fontSize.sm};
  margin-top: ${space(1)};
  color: ${p => p.theme.tokens.content.secondary};
  align-items: center;
`;

const StyledFileSize = styled(FileSize)`
  flex: 1;
  padding-left: ${space(0.5)};
`;

const TimeWrapper = styled('div')`
  display: grid;
  gap: ${space(0.5)};
  grid-template-columns: min-content 1fr;
  flex: 2;
  align-items: center;
  padding-left: ${space(0.5)};
`;

const Name = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  margin-bottom: ${space(1)};
`;

const Description = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.secondary};
  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    line-height: 1.7;
  }
`;

const DetailsItem = styled('div')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: ${space(1)};
`;

export default DebugFileRow;
