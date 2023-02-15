import {Fragment} from 'react';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import {Role} from 'sentry/components/acl/role';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import FileSize from 'sentry/components/fileSize';
import Link from 'sentry/components/links/link';
import Tag from 'sentry/components/tag';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {IconClock, IconDelete, IconDownload} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DebugFile} from 'sentry/types/debugFiles';

import {getFeatureTooltip, getFileType} from './utils';

type Props = {
  debugFile: DebugFile;
  downloadRole: string;
  downloadUrl: string;
  onDelete: (id: string) => void;
  orgSlug: string;
  showDetails: boolean;
};

const DebugFileRow = ({
  debugFile,
  showDetails,
  downloadUrl,
  downloadRole,
  onDelete,
  orgSlug,
}: Props) => {
  const {
    id,
    data,
    debugId,
    uuid,
    size,
    dateCreated,
    objectName,
    cpuName,
    symbolType,
    codeId,
  } = debugFile;
  const fileType = getFileType(debugFile);
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
          <DescriptionText>
            {symbolType === 'proguard' && cpuName === 'any'
              ? t('proguard mapping')
              : `${cpuName} (${symbolType}${fileType ? ` ${fileType}` : ''})`}
          </DescriptionText>

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
          <Role role={downloadRole}>
            {({hasRole}) => (
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
                <Button
                  size="xs"
                  icon={<IconDownload size="xs" />}
                  href={downloadUrl}
                  disabled={!hasRole}
                >
                  {t('Download')}
                </Button>
              </Tooltip>
            )}
          </Role>
          <Access access={['project:write']}>
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
                    icon={<IconDelete size="xs" />}
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
};

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
