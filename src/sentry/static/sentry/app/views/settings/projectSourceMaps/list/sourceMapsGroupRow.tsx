import React from 'react';
import styled from '@emotion/styled';

import {t, tn} from 'app/locale';
import space from 'app/styles/space';
import TimeSince from 'app/components/timeSince';
import Button from 'app/components/button';
import {IconClock, IconFile} from 'app/icons';
import ButtonBar from 'app/components/buttonBar';
import Version from 'app/components/version';
import Count from 'app/components/count';

type Props = {
  name: string;
  date: string;
  fileCount: number;
  orgId: string;
  projectId: string;
};

const SourceMapsGroupRow = ({name, date, fileCount, orgId, projectId}: Props) => {
  return (
    <React.Fragment>
      <Column>
        <Name>
          <Version version={name} tooltipRawVersion anchor={false} truncate />
        </Name>
        <TimeWrapper>
          <IconClock size="xs" />
          <TimeSince date={date} />
        </TimeWrapper>
      </Column>
      <Column>
        <FilesCount>
          <Count value={fileCount} /> {tn('file', 'files', fileCount)}
        </FilesCount>
      </Column>
      <RightColumn>
        <ButtonBar gap={0.5}>
          <Button
            size="xsmall"
            icon={<IconFile size="xs" />}
            to={`/settings/${orgId}/projects/${projectId}/source-maps/${encodeURIComponent(
              name
            )}`}
          >
            {t('Browse')}
          </Button>
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
`;

const RightColumn = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: center;
`;

const Name = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
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

const FilesCount = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

export default SourceMapsGroupRow;
