import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Feature from 'app/components/acl/feature';
import {SectionHeading} from 'app/components/charts/styles';
import Link from 'app/components/links/link';
import QuestionTooltip from 'app/components/questionTooltip';
import UserMisery from 'app/components/userMisery';
import {IconOpen} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {getAggregateAlias, WebVital} from 'app/utils/discover/fields';
import {WEB_VITAL_DETAILS} from 'app/utils/performance/vitals/constants';
import {decodeScalar} from 'app/utils/queryString';
import {getTermHelp, PERFORMANCE_TERM} from 'app/views/performance/data';
import {
  PERCENTILE as VITAL_PERCENTILE,
  VITAL_GROUPS,
} from 'app/views/performance/transactionVitals/constants';
import {vitalsRouteWithQuery} from 'app/views/performance/transactionVitals/utils';

import VitalInfo from '../vitalDetail/vitalInfo';

import {SidebarSpacer} from './utils';

type Props = {
  eventView: EventView;
  totals: Record<string, number>;
  location: Location;
  organization: Organization;
  transactionName: string;
};

function UserStats({eventView, totals, location, organization, transactionName}: Props) {
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

    apdex = totals[`apdex_${threshold}`].toFixed(4);

    const [vitalsPassed, vitalsTotal] = VITAL_GROUPS.map(({vitals: vs}) => vs).reduce(
      ([passed, total], vs) => {
        vs.forEach(vital => {
          const alias = getAggregateAlias(`percentile(${vital}, ${VITAL_PERCENTILE})`);
          if (Number.isFinite(totals[alias])) {
            total += 1;
            if (totals[alias] < WEB_VITAL_DETAILS[vital].poorThreshold) {
              passed += 1;
            }
          }
        });
        return [passed, total];
      },
      [0, 0]
    );
    if (vitalsTotal > 0) {
      vitalsPassRate = <StatNumber>{`${vitalsPassed}/${vitalsTotal}`}</StatNumber>;
    }
  }

  const webVitalsTarget = vitalsRouteWithQuery({
    orgSlug: organization.slug,
    transaction: transactionName,
    projectID: decodeScalar(location.query.project),
    query: location.query,
  });

  return (
    <React.Fragment>
      <SectionHeading>
        {t('Apdex Score')}
        <QuestionTooltip
          position="top"
          title={t(
            'Apdex is the ratio of both satisfactory and tolerable response time to all response times.'
          )}
          size="sm"
        />
      </SectionHeading>
      <StatNumber>{apdex}</StatNumber>
      <Link to={`/settings/${organization.slug}/performance/`}>
        <SectionValue>
          {threshold}ms {t('threshold')}
        </SectionValue>
      </Link>

      <SidebarSpacer />

      <Feature features={['organizations:performance-vitals-overview']}>
        {({hasFeature}) => {
          if (vitalsPassRate !== null && hasFeature) {
            return (
              <React.Fragment>
                <VitalsHeading>
                  <SectionHeading>
                    {t('Web Vitals')}
                    <QuestionTooltip
                      position="top"
                      title={t(
                        'Web Vitals with p75 better than the "poor" threshold, as defined by Google Web Vitals.'
                      )}
                      size="sm"
                    />
                  </SectionHeading>
                  <Link to={webVitalsTarget}>
                    <IconOpen />
                  </Link>
                </VitalsHeading>
                <VitalInfo
                  eventView={eventView}
                  organization={organization}
                  location={location}
                  vital={[WebVital.FCP, WebVital.LCP, WebVital.FID, WebVital.CLS]}
                  hideVitalPercentNames
                  hideDurationDetail
                />

                <SidebarSpacer />
              </React.Fragment>
            );
          } else {
            return (
              vitalsPassRate !== null && (
                <React.Fragment>
                  <SectionHeading>
                    {t('Web Vitals')}
                    <QuestionTooltip
                      position="top"
                      title={t(
                        'Web Vitals with p75 better than the "poor" threshold, as defined by Google Web Vitals.'
                      )}
                      size="sm"
                    />
                  </SectionHeading>
                  <StatNumber>{vitalsPassRate}</StatNumber>
                  <Link to={webVitalsTarget}>
                    <SectionValue>{t('Passed')}</SectionValue>
                  </Link>

                  <SidebarSpacer />
                </React.Fragment>
              )
            );
          }
        }}
      </Feature>

      <SectionHeading>
        {t('User Misery')}
        <QuestionTooltip
          position="top"
          title={getTermHelp(organization, PERFORMANCE_TERM.USER_MISERY)}
          size="sm"
        />
      </SectionHeading>
      {userMisery}
    </React.Fragment>
  );
}

const VitalsHeading = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const StatNumber = styled('div')`
  font-size: 32px;
  margin-bottom: ${space(0.5)};
  color: ${p => p.theme.textColor};
`;

const SectionValue = styled('span')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

export default UserStats;
