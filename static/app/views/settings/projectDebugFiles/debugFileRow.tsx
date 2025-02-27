import {Fragment} from 'react';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import {useRole} from 'sentry/components/acl/useRole';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import {Tag} from 'sentry/components/core/badge/tag';
import FileSize from 'sentry/components/fileSize';
import Link from 'sentry/components/links/link';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
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
  const {hasRole, roleRequired: downloadRole} = useRole({role: 'debugFilesRole'});
  const {id, data, debugId, uuid, size, dateCreated, objectName, symbolType, codeId} =
    debugFile;
  const {features} = data || {};

  return (
    <Fragment>
      <Column>
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
      </Column>
      <Column>
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
                <StyledTag key={feature} tooltipText={getFeatureTooltip(feature)}>
                  {feature}
                </StyledTag>
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
      </Column>
      <RightColumn>
        <ButtonBar gap={0.5}>
          <Tooltip
            disabled={hasRole}
            title={tct(
              'Debug files can only be downloaded by users with organization [downloadRole] role[orHigher]. This can be changed in [settingsLink:Debug Files Access] settings.',
              {
                downloadRole,
                orHigher: downloadRole !== 'owner' ? ` ${t('or higher')}` : '',
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
      </RightColumn>
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

const Column = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`;

const RightColumn = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  margin-top: ${space(1)};
`;

const DebugId = styled('code')`
  font-size: ${p => p.theme.fontSizeSmall};
`;

const TimeAndSizeWrapper = styled('div')`
  width: 100%;
  display: flex;
  font-size: ${p => p.theme.fontSizeSmall};
  margin-top: ${space(1)};
  color: ${p => p.theme.subText};
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
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(1)};
`;

const Description = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  @media (max-width: ${p => p.theme.breakpoints.large}) {
    line-height: 1.7;
  }
`;

const DetailsItem = styled('div')`
  ${p => p.theme.overflowEllipsis}
  margin-top: ${space(1)}
`;

export default DebugFileRow;
