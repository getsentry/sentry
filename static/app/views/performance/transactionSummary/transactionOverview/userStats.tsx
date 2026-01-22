import {Fragment} from 'react';
import type {Location} from 'history';

import {Flex} from '@sentry/scraps/layout';

import {SectionHeading} from 'sentry/components/charts/styles';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import UserMisery from 'sentry/components/userMisery';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {DemoTourElement, DemoTourStep} from 'sentry/utils/demoMode/demoTours';
import type EventView from 'sentry/utils/discover/eventView';
import type {QueryError} from 'sentry/utils/discover/genericDiscoverQuery';
import {WebVital} from 'sentry/utils/fields';
import {useMetricsCardinalityContext} from 'sentry/utils/performance/contexts/metricsCardinality';
import {useMEPSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {getTermHelp, PerformanceTerm} from 'sentry/views/performance/data';
import {getTransactionMEPParamsIfApplicable} from 'sentry/views/performance/transactionSummary/transactionOverview/utils';
import {SidebarSpacer} from 'sentry/views/performance/transactionSummary/utils';
import VitalInfo from 'sentry/views/performance/vitalDetail/vitalInfo';

type Props = {
  error: QueryError | null;
  eventView: EventView;
  hasWebVitals: boolean;
  isLoading: boolean;
  location: Location;
  organization: Organization;
  totals: Record<string, number> | null;
  transactionName: string;
};

function UserStats({
  isLoading,
  hasWebVitals,
  error,
  totals,
  location,
  organization,
  eventView,
}: Props) {
  let userMisery = error === null ? <Placeholder height="34px" /> : <div>{'\u2014'}</div>;

  if (!isLoading && error === null && totals) {
    const threshold: number | undefined = totals.project_threshold_config
      ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        totals.project_threshold_config[1]
      : undefined;
    const miserableUsers: number | undefined = totals['count_miserable_user()'];
    const userMiseryScore: number = totals['user_misery()'] || 0;
    const totalUsers = totals['count_unique_user()'];
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

  const mepSetting = useMEPSettingContext();
  const mepCardinalityContext = useMetricsCardinalityContext();
  const queryExtras = getTransactionMEPParamsIfApplicable(
    mepSetting,
    mepCardinalityContext,
    organization
  );

  return (
    <Fragment>
      {hasWebVitals && (
        <Fragment>
          <Flex justify="between" align="center">
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
          </Flex>
          <VitalInfo
            location={location}
            vital={[WebVital.FCP, WebVital.LCP, WebVital.FID, WebVital.CLS]}
            orgSlug={orgSlug}
            environment={eventView.environment}
            start={eventView.start}
            end={eventView.end}
            statsPeriod={eventView.statsPeriod}
            project={eventView.project}
            hideVitalThresholds
            hideDurationDetail
            queryExtras={queryExtras}
          />
          <SidebarSpacer />
        </Fragment>
      )}
      <Fragment>
        <DemoTourElement
          id={DemoTourStep.PERFORMANCE_USER_MISERY}
          title={t('Identify the root cause')}
          description={t(
            `Dive into the details behind a slow transaction.
              See User Misery, Apdex, and more metrics, along with related events and suspect spans.`
          )}
        >
          <SectionHeading>
            {t('User Misery')}
            <QuestionTooltip
              position="top"
              title={getTermHelp(organization, PerformanceTerm.USER_MISERY)}
              size="sm"
            />
          </SectionHeading>
        </DemoTourElement>
        {userMisery}
      </Fragment>

      <SidebarSpacer />
    </Fragment>
  );
}

export default UserStats;
