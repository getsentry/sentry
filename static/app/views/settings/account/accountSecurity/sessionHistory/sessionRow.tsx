import styled from '@emotion/styled';

import {PanelItem} from 'app/components/panels';
import TimeSince from 'app/components/timeSince';
import space from 'app/styles/space';
import {InternetProtocol} from 'app/types';

import {tableLayout} from './utils';

function SessionRow({
  ipAddress,
  lastSeen,
  firstSeen,
  countryCode,
  regionCode,
}: Omit<InternetProtocol, 'id'>) {
  return (
    <SessionPanelItem>
      <IpAndLocation>
        <IpAddress>{ipAddress}</IpAddress>
        {countryCode && regionCode && (
          <CountryCode>{`${countryCode} (${regionCode})`}</CountryCode>
        )}
      </IpAndLocation>
      <StyledTimeSince date={firstSeen} />
      <StyledTimeSince date={lastSeen} />
    </SessionPanelItem>
  );
}

export default SessionRow;

const IpAddress = styled('div')`
  margin-bottom: ${space(0.5)};
  font-weight: bold;
`;
const CountryCode = styled('div')`
  font-size: ${p => p.theme.fontSizeRelativeSmall};
`;

const StyledTimeSince = styled(TimeSince)`
  font-size: ${p => p.theme.fontSizeRelativeSmall};
`;

const IpAndLocation = styled('div')`
  flex: 1;
`;

const SessionPanelItem = styled(PanelItem)`
  ${tableLayout};
`;
