import styled from '@emotion/styled';

import PanelItem from 'sentry/components/panels/panelItem';
import TimeSince from 'sentry/components/timeSince';
import {space} from 'sentry/styles/space';
import {InternetProtocol} from 'sentry/types';

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
      <div>
        <StyledTimeSince date={firstSeen} />
      </div>
      <div>
        <StyledTimeSince date={lastSeen} />
      </div>
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
