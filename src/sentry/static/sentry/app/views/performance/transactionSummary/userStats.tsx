import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Feature from 'app/components/acl/feature';
import {SectionHeading} from 'app/components/charts/styles';
import Link from 'app/components/links/link';
import Placeholder from 'app/components/placeholder';
import QuestionTooltip from 'app/components/questionTooltip';
import UserMiseryPrototype from 'app/components/userMiseryPrototype';
import {IconOpen} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {getAggregateAlias, WebVital} from 'app/utils/discover/fields';
import {WEB_VITAL_DETAILS} from 'app/utils/performance/vitals/constants';
import {decodeScalar} from 'app/utils/queryString';
import {getTermHelp, PERFORMANCE_TERM} from 'app/views/performance/data';
import {SidebarSpacer} from 'app/views/performance/transactionSummary/utils';
import {
  PERCENTILE as VITAL_PERCENTILE,
  VITAL_GROUPS,
} from 'app/views/performance/transactionVitals/constants';
import {vitalsRouteWithQuery} from 'app/views/performance/transactionVitals/utils';

import VitalInfo from '../vitalDetail/vitalInfo';

type Props = {
  eventView: EventView;
  isLoading: boolean;
  error: string | null;
  totals: Record<string, number> | null;
  location: Location;
  organization: Organization;
  transactionName: string;
};

function UserStats({
  eventView,
  isLoading,
  error,
  totals,
  location,
  organization,
  transactionName,
}: Props) {
  let userMisery = error !== null ? <div>{'\u2014'}</div> : <Placeholder height="34px" />;
  const threshold = organization.apdexThreshold;
  let vitalsPassRate: React.ReactNode = null;

  if (!isLoading && error === null && totals) {
    const miserableUsers = totals[`user_misery_${threshold}`];
    const userMiseryScore = totals[`user_misery_prototype_${threshold}`];
    const totalUsers = totals.count_unique_user;
    userMisery = (
      <UserMiseryPrototype
        bars={40}
        barHeight={30}
        userMisery={userMiseryScore}
        miseryLimit={threshold}
        totalUsers={totalUsers}
        miserableUsers={miserableUsers}
      />
    );

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
      <SidebarSpacer />
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

  > div {
    text-align: left;
  }
`;

const SectionValue = styled('span')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

export default UserStats;
