import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import {Organization} from 'app/types';
import space from 'app/styles/space';
import {t} from 'app/locale';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import {getTermHelp} from 'app/views/performance/data';
import QuestionTooltip from 'app/components/questionTooltip';
import {SectionHeading} from 'app/components/charts/styles';
import UserMisery from 'app/components/userMisery';

type Props = {
  totals: Record<string, number> | undefined;
  location: Location;
  organization: Organization;
};

function UserStats({totals, location, organization}: Props) {
  let userMisery = <StatNumber>{'\u2014'}</StatNumber>;
  const threshold = organization.apdexThreshold;
  let apdex: React.ReactNode = <StatNumber>{'\u2014'}</StatNumber>;

  if (totals) {
    const miserableUsers = Number(totals[`user_misery_${threshold}`]);
    const totalUsers = Number(totals.count_unique_user);
    if (!isNaN(miserableUsers) && !isNaN(totalUsers)) {
      userMisery = (
        <UserMisery
          bars={40}
          barHeight={30}
          miseryLimit={threshold}
          totalUsers={totalUsers}
          miserableUsers={miserableUsers}
        />
      );
    }

    const apdexKey = `apdex_${threshold}`;
    const formatter = getFieldRenderer(apdexKey, {[apdexKey]: 'number'});
    apdex = formatter(totals, {organization, location});
  }

  return (
    <Container>
      <div>
        <SectionHeading>{t('Apdex Score')}</SectionHeading>
        <StatNumber>{apdex}</StatNumber>
      </div>
      <UserMiseryContainer>
        <SectionHeading>
          {t('User Misery')}
          <QuestionTooltip
            position="top"
            title={getTermHelp(organization, 'userMisery')}
            size="sm"
          />
        </SectionHeading>
        {userMisery}
      </UserMiseryContainer>
    </Container>
  );
}

const Container = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-row-gap: ${space(4)};
  margin-bottom: 40px;
`;

const UserMiseryContainer = styled('div')`
  grid-column: 1/3;
`;

const StatNumber = styled('div')`
  font-size: 32px;
  color: ${p => p.theme.gray700};

  > div {
    text-align: left;
  }
`;

export default UserStats;
