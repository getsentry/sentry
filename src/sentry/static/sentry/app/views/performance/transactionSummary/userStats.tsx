import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import Feature from 'app/components/acl/feature';
import Link from 'app/components/links/link';
import {Organization} from 'app/types';
import space from 'app/styles/space';
import {t} from 'app/locale';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import {WebVital, getAggregateAlias} from 'app/utils/discover/fields';
import {getTermHelp} from 'app/views/performance/data';
import QuestionTooltip from 'app/components/questionTooltip';
import {SectionHeading} from 'app/components/charts/styles';
import UserMisery from 'app/components/userMisery';
import {generateWebVitalsRoute} from 'app/views/performance/realUserMonitoring/utils';
import {
  PERCENTILE as VITAL_PERCENTILE,
  WEB_VITAL_DETAILS,
} from 'app/views/performance/realUserMonitoring/constants';

type Props = {
  totals: Record<string, number>;
  location: Location;
  organization: Organization;
};

function UserStats({totals, location, organization}: Props) {
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

    const [vitalsPassed, vitalsTotal] = Object.values(WebVital)
      .filter(vital => WEB_VITAL_DETAILS[vital].includeInSummary)
      .reduce(
        ([passed, total], vital) => {
          const alias = getAggregateAlias(`percentile(${vital}, ${VITAL_PERCENTILE})`);
          if (totals[alias] !== null && !isNaN(totals[alias])) {
            total += 1;
            if (totals[alias] < WEB_VITAL_DETAILS[vital].failureThreshold) {
              passed += 1;
            }
          }
          return [passed, total];
        },
        [0, 0]
      );
    if (vitalsTotal > 0) {
      vitalsPassRate = <StatNumber>{`${vitalsPassed} / ${vitalsTotal}`}</StatNumber>;
    }
  }

  const webVitalsRoute = generateWebVitalsRoute({orgSlug: organization.slug});

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
            <Link to={`${webVitalsRoute}${location.search}`}>
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
