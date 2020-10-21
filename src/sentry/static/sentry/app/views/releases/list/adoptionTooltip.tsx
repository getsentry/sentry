import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import Count from 'app/components/count';

type Props = {
  totalUsers: number;
  totalUsers24h: number | null;
  totalSessions: number;
  totalSessions24h: number | null;
};

const AdoptionTooltip = ({
  totalUsers,
  totalUsers24h,
  totalSessions,
  totalSessions24h,
}: Props) => {
  return (
    <Wrapper>
      <Row>
        <Title>{t('Last 24h')}:</Title>
        <Value>
          <Count value={totalUsers24h ?? 0} />
        </Value>
      </Row>
      <Row>
        <Title>{t('Total Users')}:</Title>
        <Value>
          <Count value={totalUsers} />
        </Value>
      </Row>
      <Divider />

      <Row>
        <Title>{t('Last 24h')}:</Title>
        <Value>
          <Count value={totalSessions24h ?? 0} />
        </Value>
      </Row>
      <Row>
        <Title>{t('Total Sessions')}:</Title>
        <Value>
          <Count value={totalSessions} />
        </Value>
      </Row>
    </Wrapper>
  );
};

const Wrapper = styled('div')`
  padding: ${space(0.75)};
`;
const Row = styled('div')`
  display: grid;
  grid-template-columns: auto auto;
  grid-gap: ${space(4)};
  justify-content: space-between;
  padding-bottom: ${space(0.25)};
`;
const Title = styled('div')`
  text-align: left;
`;
const Value = styled('div')`
  color: ${p => p.theme.gray500};
  text-align: right;
`;
const Divider = styled('div')`
  border-top: 1px solid ${p => p.theme.gray800};
  margin: ${space(0.75)} -${space(2)} ${space(1)};
`;

export default AdoptionTooltip;
