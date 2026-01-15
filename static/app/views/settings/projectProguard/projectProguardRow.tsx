import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import Access from 'sentry/components/acl/access';
import {useRole} from 'sentry/components/acl/useRole';
import Confirm from 'sentry/components/confirm';
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
import type {ProguardMappingAssociation} from 'sentry/views/settings/projectProguard';

type Props = {
  downloadUrl: string;
  mapping: DebugFile;
  onDelete: (id: string) => void;
  orgSlug: string;
  associations?: ProguardMappingAssociation;
};

function ProjectProguardRow({mapping, onDelete, downloadUrl, orgSlug}: Props) {
  const {hasRole, roleRequired: downloadRole} = useRole({role: 'debugFilesRole'});
  const {id, debugId, uuid, size, dateCreated} = mapping;

  const handleDeleteClick = () => {
    onDelete(id);
  };

  return (
    <Fragment>
      <Stack justify="center" align="start">
        <Name>{debugId || uuid || `(${t('empty')})`}</Name>
        <TimeWrapper>
          <IconClock size="sm" />
          <TimeSince date={dateCreated} />
        </TimeWrapper>
      </Stack>
      <SizeColumn>
        <FileSize bytes={size} />
      </SizeColumn>
      <ActionsColumn>
        <ButtonBar gap="xs">
          <Tooltip
            title={tct(
              'Mappings can only be downloaded by users with organization [downloadRole] role[orHigher]. This can be changed in [settingsLink:Debug Files Access] settings.',
              {
                downloadRole,
                orHigher: downloadRole === 'owner' ? '' : ` ${t('or higher')}`,
                settingsLink: <Link to={`/settings/${orgSlug}/#debugFilesRole`} />,
              }
            )}
            disabled={hasRole}
            isHoverable
          >
            <LinkButton
              size="sm"
              icon={<IconDownload size="sm" />}
              disabled={!hasRole}
              href={downloadUrl}
              title={hasRole ? t('Download Mapping') : undefined}
              aria-label={t('Download Mapping')}
            />
          </Tooltip>

          <Access access={['project:releases']}>
            {({hasAccess}) => (
              <Tooltip
                disabled={hasAccess}
                title={t('You do not have permission to delete mappings.')}
              >
                <Confirm
                  message={t('Are you sure you want to remove this mapping?')}
                  onConfirm={handleDeleteClick}
                  disabled={!hasAccess}
                >
                  <Button
                    size="sm"
                    icon={<IconDelete size="sm" />}
                    title={hasAccess ? t('Remove Mapping') : undefined}
                    aria-label={t('Remove Mapping')}
                    disabled={!hasAccess}
                  />
                </Confirm>
              </Tooltip>
            )}
          </Access>
        </ButtonBar>
      </ActionsColumn>
    </Fragment>
  );
}

const SizeColumn = styled('div')`
  display: flex;
  justify-content: flex-end;
  text-align: right;
  align-items: center;
`;

const ActionsColumn = styled(SizeColumn)``;

const Name = styled('div')`
  padding-right: ${space(4)};
  overflow-wrap: break-word;
  word-break: break-all;
`;

const TimeWrapper = styled('div')`
  display: grid;
  gap: ${space(0.5)};
  grid-template-columns: min-content 1fr;
  font-size: ${p => p.theme.fontSize.md};
  align-items: center;
  color: ${p => p.theme.tokens.content.secondary};
  margin-top: ${space(1)};
`;

export default ProjectProguardRow;
