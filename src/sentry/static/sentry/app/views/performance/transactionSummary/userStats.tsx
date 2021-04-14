import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {SectionHeading} from 'app/components/charts/styles';
import Link from 'app/components/links/link';
import Placeholder from 'app/components/placeholder';
import QuestionTooltip from 'app/components/questionTooltip';
import UserMisery from 'app/components/userMisery';
import {IconOpen} from 'app/icons';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {WebVital} from 'app/utils/discover/fields';
import {decodeScalar} from 'app/utils/queryString';
import {getTermHelp, PERFORMANCE_TERM} from 'app/views/performance/data';
import {SidebarSpacer} from 'app/views/performance/transactionSummary/utils';
import {vitalsRouteWithQuery} from 'app/views/performance/transactionVitals/utils';

import VitalInfo from '../vitalDetail/vitalInfo';

type Props = {
  eventView: EventView;
  isLoading: boolean;
  hasWebVitals: boolean;
  error: string | null;
  totals: Record<string, number> | null;
  location: Location;
  organization: Organization;
  transactionName: string;
};

function UserStats({
  eventView,
  isLoading,
  hasWebVitals,
  error,
  totals,
  location,
  organization,
  transactionName,
}: Props) {
  let userMisery = error !== null ? <div>{'\u2014'}</div> : <Placeholder height="34px" />;
  const threshold = organization.apdexThreshold;

  if (!isLoading && error === null && totals) {
    const miserableUsers = totals[`count_miserable_user_${threshold}`];
    const userMiseryScore = totals[`user_misery_${threshold}`];
    const totalUsers = totals.count_unique_user;
    userMisery = (
      <UserMisery
        bars={40}
        barHeight={30}
        userMisery={userMiseryScore}
        miseryLimit={threshold}
        totalUsers={totalUsers}
        miserableUsers={miserableUsers}
      />
    );
  }

  const webVitalsTarget = vitalsRouteWithQuery({
    orgSlug: organization.slug,
    transaction: transactionName,
    projectID: decodeScalar(location.query.project),
    query: location.query,
  });

  return (
    <React.Fragment>
      {hasWebVitals && (
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
      )}
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

export default UserStats;
