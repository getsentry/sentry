import styled from '@emotion/styled';

import DateTime from 'app/components/dateTime';
import NotAvailable from 'app/components/notAvailable';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {AppStoreConnectStatusData} from 'app/types/debugFiles';

type Props = {
  details?: AppStoreConnectStatusData;
};

function Details({details}: Props) {
  const {latestBuildVersion, latestBuildNumber, lastCheckedBuilds} = details ?? {};
  return (
    <Wrapper>
      {t('Last detected version')}
      <Value>
        {latestBuildVersion ? (
          tct('v[version]', {version: latestBuildVersion})
        ) : (
          <NotAvailable tooltip={t('Not available')} />
        )}
      </Value>

      {t('Last detected build')}
      <Value>{latestBuildNumber ?? <NotAvailable tooltip={t('Not available')} />}</Value>

      {t('Detected last build on')}
      <Value>
        {lastCheckedBuilds ? (
          <DateTime date={lastCheckedBuilds} />
        ) : (
          <NotAvailable tooltip={t('Not available')} />
        )}
      </Value>
    </Wrapper>
  );
}

export default Details;

const Wrapper = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
  margin-top: ${space(0.5)};
  align-items: center;

  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 700;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    margin-top: ${space(1)};
    grid-template-columns: max-content 1fr;
    grid-gap: ${space(1)};
    grid-row: 3/3;
    grid-column: 1/-1;
  }
`;

const Value = styled('div')`
  font-weight: 400;
  white-space: pre-wrap;
  word-break: break-all;
  padding: ${space(1)} ${space(1.5)};
  font-family: ${p => p.theme.text.familyMono};
  background-color: ${p => p.theme.backgroundSecondary};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    :not(:last-child) {
      margin-bottom: ${space(1)};
    }
  }
`;
