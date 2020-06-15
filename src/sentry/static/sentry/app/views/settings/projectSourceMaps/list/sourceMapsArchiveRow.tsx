import React from 'react';
import styled from '@emotion/styled';

import {SourceMapsArchive} from 'app/types';
import {t} from 'app/locale';
import space from 'app/styles/space';
import TimeSince from 'app/components/timeSince';
import Button from 'app/components/button';
import {IconClock, IconFile, IconDelete} from 'app/icons';
import ButtonBar from 'app/components/buttonBar';
import Version from 'app/components/version';
import Count from 'app/components/count';
import Confirm from 'app/components/confirm';
import Link from 'app/components/links/link';

type Props = {
  archive: SourceMapsArchive;
  orgId: string;
  projectId: string;
  onDelete: (id: number) => void;
};

const SourceMapsArchiveRow = ({archive, orgId, projectId, onDelete}: Props) => {
  const {id, name, date, fileCount} = archive;
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
        <TimeWrapper>
          <IconClock size="xs" />
          <TimeSince date={date} />
        </TimeWrapper>
      </Column>
      <Column>
        <Count value={fileCount} />
      </Column>
      <RightColumn>
        <ButtonBar gap={0.5}>
          <Button size="xsmall" icon={<IconFile size="xs" />} to={archiveLink}>
            {t('Open')}
          </Button>
          <Confirm
            onConfirm={() => onDelete(id)}
            message={t('Are you sure you want to remove all artifacts in this archive?')}
          >
            <Button size="xsmall" icon={<IconDelete size="xs" />} priority="danger" />
          </Confirm>
        </ButtonBar>
      </RightColumn>
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

const RightColumn = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: center;
`;

const Name = styled('div')`
  max-width: 100%;
`;

const TimeWrapper = styled('div')`
  display: grid;
  grid-gap: ${space(0.5)};
  grid-template-columns: min-content 1fr;
  margin-top: ${space(1)};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray600};
`;

export default SourceMapsArchiveRow;
