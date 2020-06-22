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
        <Name>
          <Link to={archiveLink}>
            <Version version={name} anchor={false} truncate />
          </Link>
        </Name>
      </Column>
      <Column>
        <DateTime date={date} />
      </Column>
      <Column>
        <Count value={fileCount} />
      </Column>
      <ActionsColumn>
        <ButtonBar gap={0.5}>
          <Confirm
            onConfirm={() => onDelete(name)}
            message={t('Are you sure you want to remove all artifacts in this archive?')}
          >
            <Button
              size="small"
              icon={<IconDelete size="xs" />}
              title={t('Delete Archive')}
            />
          </Confirm>
        </ButtonBar>
      </ActionsColumn>
    </React.Fragment>
  );
};

const Column = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const ActionsColumn = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: center;
`;

const Name = styled('div')`
  max-width: 100%;
`;

export default SourceMapsArchiveRow;
