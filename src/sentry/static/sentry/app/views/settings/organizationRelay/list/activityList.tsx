import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {PanelTable} from 'app/components/panels';
import {RelayActivity} from 'app/types';
import DateTime from 'app/components/dateTime';
import space from 'app/styles/space';
import Clipboard from 'app/components/clipboard';
import {IconCopy} from 'app/icons';
import Tooltip from 'app/components/tooltip';

import {getShortPublicKey} from './utils';

type Props = {
  activities: Array<RelayActivity>;
};

const ActivityList = ({activities}: Props) => (
  <StyledPanelTable headers={[t('ID'), t('Version'), t('First Used'), t('Last Used')]}>
    {activities.map(({publicKey, relayId, version, firstSeen, lastSeen}) => {
      return (
        <React.Fragment key={relayId}>
          <PublicKeyWrapper>
            {getShortPublicKey(publicKey)}
            <IconCopyWrapper>
              <Clipboard value={publicKey}>
                <Tooltip title={t('Click to copy')} containerDisplayMode="flex">
                  <IconCopy color="gray500" />
                </Tooltip>
              </Clipboard>
            </IconCopyWrapper>
          </PublicKeyWrapper>
          <div>{version}</div>
          <DateTime date={firstSeen} seconds={false} />
          <DateTime date={lastSeen} seconds={false} />
        </React.Fragment>
      );
    })}
  </StyledPanelTable>
);

export default ActivityList;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 2fr 1fr 1.5fr 3fr;
`;

const IconCopyWrapper = styled('div')`
  justify-content: flex-start;
  display: flex;
  cursor: pointer;
`;

const PublicKeyWrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1)};
`;
