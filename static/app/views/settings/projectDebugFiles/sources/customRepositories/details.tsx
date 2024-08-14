import styled from '@emotion/styled';

import NotAvailable from 'sentry/components/notAvailable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

function Details() {
  return (
    <Wrapper>
      {t('Last detected version')}
      <Value>
        <NotAvailable tooltip={t('Not available')} />
      </Value>

      {t('Last detected build')}
      <Value>{<NotAvailable tooltip={t('Not available')} />}</Value>

      {t('Detected last build on')}
      <Value>
        <NotAvailable tooltip={t('Not available')} />
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
  font-weight: ${p => p.theme.fontWeightBold};

  grid-column: 2/-1;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    margin-top: ${space(1)};
    grid-template-columns: max-content 1fr;
    gap: ${space(1)};
    grid-row: 3/3;
  }
`;

const Value = styled('div')`
  font-weight: ${p => p.theme.fontWeightNormal};
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
