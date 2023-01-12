import {Fragment, useState} from 'react';
import {browserHistory, InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import omit from 'lodash/omit';

import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import ButtonBar from 'sentry/components/buttonBar';
import {getInterval} from 'sentry/components/charts/utils';
import {CreateAlertFromViewButton} from 'sentry/components/createAlertButton';
import DatePageFilter from 'sentry/components/datePageFilter';
import DropdownMenuControl from 'sentry/components/dropdownMenuControl';
import {MenuItemProps} from 'sentry/components/dropdownMenuItem';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import SearchBar from 'sentry/components/events/searchBar';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import * as TeamKeyTransactionManager from 'sentry/components/performance/teamKeyTransactionsManager';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import {IconCheckmark, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import EventView from 'sentry/utils/discover/eventView';
import {WebVital} from 'sentry/utils/fields';
import {Browser} from 'sentry/utils/performance/vitals/constants';
import {decodeScalar} from 'sentry/utils/queryString';
import Teams from 'sentry/utils/teams';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import withProjects from 'sentry/utils/withProjects';

import Breadcrumb from '../breadcrumb';
import {getTransactionSearchQuery} from '../utils';

import Table from './table';
import {
  vitalAbbreviations,
  vitalAlertTypes,
  vitalDescription,
  vitalMap,
  vitalSupportedBrowsers,
} from './utils';
import VitalChart from './vitalChart';
import VitalInfo from './vitalInfo';

const FRONTEND_VITALS = [WebVital.FCP, WebVital.LCP, WebVital.FID, WebVital.CLS];

type Props = {
  api: Client;
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
  router: InjectedRouter;
  vitalName: WebVital;
};

function getSummaryConditions(query: string) {
  const parsed = new MutableSearch(query);
  parsed.freeText = [];

  return parsed.formatString();
}

function VitalDetailContent(props: Props) {
  const [error, setError] = useState<string | undefined>(undefined);

  function handleSearch(query: string) {
    const {location} = props;

    const queryParams = normalizeDateTimeParams({
      ...(location.query || {}),
      query,
    });

    // do not propagate pagination when making a new search
    const searchQueryParams = omit(queryParams, 'cursor');

    browserHistory.push({
      pathname: location.pathname,
      query: searchQueryParams,
    });
  }

  function renderCreateAlertButton() {
    const {eventView, organization, projects, vitalName} = props;

    return (
      <CreateAlertFromViewButton
        eventView={eventView}
        organization={organization}
        projects={projects}
        aria-label={t('Create Alert')}
        alertType={vitalAlertTypes[vitalName]}
        referrer="performance"
      />
    );
  }

  function renderVitalSwitcher() {
    const {vitalName, location, organization} = props;

    const position = FRONTEND_VITALS.indexOf(vitalName);

    if (position < 0) {
      return null;
    }

    const items: MenuItemProps[] = FRONTEND_VITALS.reduce(
      (acc: MenuItemProps[], newVitalName) => {
        const itemProps = {
          key: newVitalName,
          label: vitalAbbreviations[newVitalName],
          onAction: function switchWebVital() {
            browserHistory.push({
              pathname: location.pathname,
              query: {
                ...location.query,
                vitalName: newVitalName,
                cursor: undefined,
              },
            });

            trackAdvancedAnalyticsEvent('performance_views.vital_detail.switch_vital', {
              organization,
              from_vital: vitalAbbreviations[vitalName] ?? 'undefined',
              to_vital: vitalAbbreviations[newVitalName] ?? 'undefined',
            });
          },
        };

        if (vitalName === newVitalName) {
          acc.unshift(itemProps);
        } else {
          acc.push(itemProps);
        }

        return acc;
      },
      []
    );

    return (
      <DropdownMenuControl
        items={items}
        triggerLabel={vitalAbbreviations[vitalName]}
        triggerProps={{
          'aria-label': `Web Vitals: ${vitalAbbreviations[vitalName]}`,
          prefix: t('Web Vitals'),
        }}
        position="bottom-start"
      />
    );
  }

  function renderError() {
    if (!error) {
      return null;
    }

    return (
      <Alert type="error" showIcon>
        {error}
      </Alert>
    );
  }

  function renderContent(vital: WebVital) {
    const {location, organization, eventView, projects} = props;

    const {fields, start, end, statsPeriod, environment, project} = eventView;

    const query = decodeScalar(location.query.query, '');
    const orgSlug = organization.slug;
    const localDateStart = start ? getUtcToLocalDateObject(start) : null;
    const localDateEnd = end ? getUtcToLocalDateObject(end) : null;
    const interval = getInterval(
      {start: localDateStart, end: localDateEnd, period: statsPeriod},
      'high'
    );
    const filterString = getTransactionSearchQuery(location);
    const summaryConditions = getSummaryConditions(filterString);

    return (
      <Fragment>
        <FilterActions>
          <PageFilterBar condensed>
            <ProjectPageFilter />
            <EnvironmentPageFilter />
            <DatePageFilter alignDropdown="left" />
          </PageFilterBar>
          <SearchBar
            searchSource="performance_vitals"
            organization={organization}
            projectIds={project}
            query={query}
            fields={fields}
            onSearch={handleSearch}
          />
        </FilterActions>
        <VitalChart
          organization={organization}
          query={query}
          project={project}
          environment={environment}
          start={localDateStart}
          end={localDateEnd}
          statsPeriod={statsPeriod}
          interval={interval}
        />
        <StyledVitalInfo>
          <VitalInfo
            orgSlug={orgSlug}
            location={location}
            vital={vital}
            project={project}
            environment={environment}
            start={start}
            end={end}
            statsPeriod={statsPeriod}
          />
        </StyledVitalInfo>

        <Teams provideUserTeams>
          {({teams, initiallyLoaded}) =>
            initiallyLoaded ? (
              <TeamKeyTransactionManager.Provider
                organization={organization}
                teams={teams}
                selectedTeams={['myteams']}
                selectedProjects={project.map(String)}
              >
                <Table
                  eventView={eventView}
                  projects={projects}
                  organization={organization}
                  location={location}
                  setError={setError}
                  summaryConditions={summaryConditions}
                />
              </TeamKeyTransactionManager.Provider>
            ) : (
              <LoadingIndicator />
            )
          }
        </Teams>
      </Fragment>
    );
  }

  const {location, organization, vitalName} = props;

  const vital = vitalName || WebVital.LCP;

  return (
    <Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumb organization={organization} location={location} vitalName={vital} />
          <Layout.Title>{vitalMap[vital]}</Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <ButtonBar gap={1}>
            {renderVitalSwitcher()}
            <Feature organization={organization} features={['incidents']}>
              {({hasFeature}) => hasFeature && renderCreateAlertButton()}
            </Feature>
          </ButtonBar>
        </Layout.HeaderActions>
      </Layout.Header>
      <Layout.Body>
        {renderError()}
        <Layout.Main fullWidth>
          <StyledDescription>{vitalDescription[vitalName]}</StyledDescription>
          <SupportedBrowsers>
            {Object.values(Browser).map(browser => (
              <BrowserItem key={browser}>
                {vitalSupportedBrowsers[vitalName]?.includes(browser) ? (
                  <IconCheckmark color="successText" size="sm" />
                ) : (
                  <IconClose color="dangerText" size="sm" />
                )}
                {browser}
              </BrowserItem>
            ))}
          </SupportedBrowsers>
          {renderContent(vital)}
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

export default withProjects(VitalDetailContent);

const StyledDescription = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(3)};
`;

const StyledVitalInfo = styled('div')`
  margin-bottom: ${space(3)};
`;

const SupportedBrowsers = styled('div')`
  display: inline-flex;
  gap: ${space(2)};
  margin-bottom: ${space(3)};
`;

const BrowserItem = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const FilterActions = styled('div')`
  display: grid;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: auto 1fr;
  }
`;
