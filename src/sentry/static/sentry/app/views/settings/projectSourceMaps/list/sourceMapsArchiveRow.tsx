import React from 'react';
import styled from '@emotion/styled';

import {SourceMapsArchive} from 'app/types';
import {t} from 'app/locale';
import Button from 'app/components/button';
import {IconDelete} from 'app/icons';
import ButtonBar from 'app/components/buttonBar';
import Version from 'app/components/version';
import Count from 'app/components/count';
import Confirm from 'app/components/confirm';
import DateTime from 'app/components/dateTime';
import Link from 'app/components/links/link';
import TextOverflow from 'app/components/textOverflow';
import space from 'app/styles/space';
import Access from 'app/components/acl/access';
import Tooltip from 'app/components/tooltip';

type Props = {
  archive: SourceMapsArchive;
  orgId: string;
  projectId: string;
  onDelete: (name: string) => void;
};

const SourceMapsArchiveRow = ({archive, orgId, projectId, onDelete}: Props) => {
  const {name, date, fileCount} = archive;
  const archiveLink = `/settings/${orgId}/projects/${projectId}/source-maps/${encodeURIComponent(
    name
  )}`;
  return (
    <React.Fragment>
      <Column>
        <TextOverflow>
          <Link to={archiveLink}>
            <Version version={name} anchor={false} tooltipRawVersion truncate />
          </Link>
        </TextOverflow>
      </Column>
      <ArtifactsColumn>
        <Count value={fileCount} />
      </ArtifactsColumn>
      <Column>{t('release')}</Column>
      <Column>
        <DateTime date={date} />
      </Column>
      <ActionsColumn>
        <ButtonBar gap={0.5}>
          <Access access={['project:releases']}>
            {({hasAccess}) => (
              <Tooltip
                disabled={hasAccess}
                title={t('You do not have permission to delete artifacts.')}
              >
                <Confirm
                  onConfirm={() => onDelete(name)}
                  message={t(
                    'Are you sure you want to remove all artifacts in this archive?'
                  )}
                  disabled={!hasAccess}
                >
                  <Button
                    size="small"
                    icon={<IconDelete size="sm" />}
                    title={t('Remove All Artifacts')}
                    label={t('Remove All Artifacts')}
                    disabled={!hasAccess}
                  />
                </Confirm>
              </Tooltip>
            )}
          </Access>
        </ButtonBar>
      </ActionsColumn>
    </React.Fragment>
  );
};

const Column = styled('div')`
  display: flex;
  align-items: center;
  overflow: hidden;
`;

const ArtifactsColumn = styled(Column)`
  padding-right: ${space(4)};
  text-align: right;
  justify-content: flex-end;
`;

const ActionsColumn = styled(Column)`
  justify-content: flex-end;
`;

export default SourceMapsArchiveRow;
