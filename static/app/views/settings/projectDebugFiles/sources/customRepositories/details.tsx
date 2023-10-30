import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import NotAvailable from 'sentry/components/notAvailable';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {AppStoreConnectStatusData} from 'sentry/types/debugFiles';

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
  gap: ${space(1)};
  margin-top: ${space(0.5)};
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 700;

  grid-column: 2/-1;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    margin-top: ${space(1)};
    grid-template-columns: max-content 1fr;
    gap: ${space(1)};
    grid-row: 3/3;
  }
`;

const Value = styled('div')`
  font-weight: 400;
  white-space: pre-wrap;
  word-break: break-all;
  padding: ${space(1)} ${space(1.5)};
  font-family: ${p => p.theme.text.familyMono};
  background-color: ${p => p.theme.backgroundSecondary};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    :not(:last-child) {
      margin-bottom: ${space(1)};
    }
  }
`;
