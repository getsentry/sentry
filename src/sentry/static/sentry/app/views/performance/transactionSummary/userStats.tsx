import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import Feature from 'app/components/acl/feature';
import Link from 'app/components/links/link';
import QuestionTooltip from 'app/components/questionTooltip';
import {SectionHeading} from 'app/components/charts/styles';
import UserMisery from 'app/components/userMisery';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import space from 'app/styles/space';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import {getAggregateAlias} from 'app/utils/discover/fields';
import {decodeScalar} from 'app/utils/queryString';
import {getTermHelp} from 'app/views/performance/data';
import {vitalsRouteWithQuery} from 'app/views/performance/transactionVitals/utils';
import {
  PERCENTILE as VITAL_PERCENTILE,
  VITAL_GROUPS,
  WEB_VITAL_DETAILS,
} from 'app/views/performance/transactionVitals/constants';

type Props = {
  totals: Record<string, number>;
  location: Location;
  organization: Organization;
  transactionName: string;
};

function UserStats({totals, location, organization, transactionName}: Props) {
  let userMisery = <StatNumber>{'\u2014'}</StatNumber>;
  const threshold = organization.apdexThreshold;
  let apdex: React.ReactNode = <StatNumber>{'\u2014'}</StatNumber>;
  let vitalsPassRate: React.ReactNode = null;

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

    const [vitalsPassed, vitalsTotal] = VITAL_GROUPS.map(({vitals: vs}) => vs).reduce(
      ([passed, total], vs) => {
        vs.forEach(vital => {
          const alias = getAggregateAlias(`percentile(${vital}, ${VITAL_PERCENTILE})`);
          if (Number.isFinite(totals[alias])) {
            total += 1;
            if (totals[alias] < WEB_VITAL_DETAILS[vital].failureThreshold) {
              passed += 1;
            }
          }
        });
        return [passed, total];
      },
      [0, 0]
    );
    if (vitalsTotal > 0) {
      vitalsPassRate = <StatNumber>{`${vitalsPassed} / ${vitalsTotal}`}</StatNumber>;
    }
  }

  const webVitalsTarget = vitalsRouteWithQuery({
    orgSlug: organization.slug,
    transaction: transactionName,
    projectID: decodeScalar(location.query.project),
    query: location.query,
  });

  return (
    <Container>
      <div>
        <SectionHeading>{t('Apdex Score')}</SectionHeading>
        <StatNumber>{apdex}</StatNumber>
      </div>
      <Feature features={['measurements']} organization={organization}>
        {vitalsPassRate !== null && (
          <div>
            <SectionHeading>{t('Web Vitals')}</SectionHeading>
            <StatNumber>{vitalsPassRate}</StatNumber>
            <Link to={webVitalsTarget}>
              <SectionValue>{t('Passed')}</SectionValue>
            </Link>
          </div>
        )}
      </Feature>
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

const SectionValue = styled('span')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

export default UserStats;
