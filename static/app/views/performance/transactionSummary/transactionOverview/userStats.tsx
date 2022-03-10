import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {SectionHeading} from 'sentry/components/charts/styles';
import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import UserMisery from 'sentry/components/userMisery';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {WebVital} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {getTermHelp, PERFORMANCE_TERM} from 'sentry/views/performance/data';
import {vitalsRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionVitals/utils';
import {SidebarSpacer} from 'sentry/views/performance/transactionSummary/utils';
import VitalInfo from 'sentry/views/performance/vitalDetail/vitalInfo';

type Props = {
  error: string | null;
  eventView: EventView;
  hasWebVitals: boolean;
  isLoading: boolean;
  location: Location;
  organization: Organization;
  totals: Record<string, number> | null;
  transactionName: string;
  isMetricsData?: boolean;
};

function UserStats({
  isLoading,
  hasWebVitals,
  error,
  totals,
  location,
  organization,
  transactionName,
  eventView,
  isMetricsData,
}: Props) {
  let userMisery = error !== null ? <div>{'\u2014'}</div> : <Placeholder height="34px" />;

  if (!isLoading && error === null && totals) {
    const threshold: number | undefined = totals.project_threshold_config[1];
    const miserableUsers: number | undefined = totals.count_miserable_user;
    const userMiseryScore: number = totals.user_misery;
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

  const orgSlug = organization.slug;

  const webVitalsTarget = vitalsRouteWithQuery({
    orgSlug,
    transaction: transactionName,
    projectID: decodeScalar(location.query.project),
    query: location.query,
  });

  return (
    <Fragment>
      {hasWebVitals && (
        <Fragment>
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
            location={location}
            vital={[WebVital.FCP, WebVital.LCP, WebVital.FID, WebVital.CLS]}
            orgSlug={orgSlug}
            environment={eventView.environment}
            start={eventView.start}
            end={eventView.end}
            statsPeriod={eventView.statsPeriod}
            project={eventView.project}
            isMetricsData={isMetricsData}
            hideVitalPercentNames
            hideDurationDetail
          />
          <SidebarSpacer />
        </Fragment>
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
    </Fragment>
  );
}

const VitalsHeading = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export default UserStats;
