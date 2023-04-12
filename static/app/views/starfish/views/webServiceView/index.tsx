import {useEffect, useRef} from 'react';
import {InjectedRouter} from 'react-router';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {loadOrganizationTags} from 'sentry/actionCreators/tags';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PageFilters} from 'sentry/types';
import {canUseMetricsData} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';
import useProjects from 'sentry/utils/useProjects';
import withPageFilters from 'sentry/utils/withPageFilters';

import {
  generatePerformanceEventView,
  getDefaultStatsPeriod,
} from '../../utils/generatePerformanceEventView';

import {StarfishLanding} from './starfishLanding';

type Props = {
  location: Location;
  router: InjectedRouter;
  selection: PageFilters;
};

function WebServiceView({selection, location, router}: Props) {
  const api = useApi();
  const organization = useOrganization();
  const {projects} = useProjects();
  const mounted = useRef(false);
  const previousDateTime = usePrevious(selection.datetime);
  const withStaticFilters = canUseMetricsData(organization);
  const eventView = generatePerformanceEventView(
    location,
    projects,
    {
      withStaticFilters,
    },
    organization
  );

  useEffect(() => {
    if (!mounted.current) {
      loadOrganizationTags(api, organization.slug, selection);
      mounted.current = true;
      return;
    }
    if (!isEqual(previousDateTime, selection.datetime)) {
      loadOrganizationTags(api, organization.slug, selection);
    }
  }, [
    selection.datetime,
    previousDateTime,
    selection,
    api,
    organization,
    location,
    projects,
  ]);

  return (
    <SentryDocumentTitle title={t('Starfish')} orgSlug={organization.slug}>
      <PageFiltersContainer
        defaultSelection={{
          datetime: {
            start: null,
            end: null,
            utc: false,
            period: getDefaultStatsPeriod(organization),
          },
        }}
      >
        <StarfishLanding
          router={router}
          eventView={eventView}
          organization={organization}
          location={location}
          projects={projects}
          selection={selection}
          withStaticFilters={withStaticFilters}
        />
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

export default withPageFilters(WebServiceView);
