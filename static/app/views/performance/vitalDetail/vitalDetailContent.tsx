import * as React from 'react';
import {browserHistory, InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import omit from 'lodash/omit';

import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {CreateAlertFromViewButton} from 'app/components/createAlertButton';
import SearchBar from 'app/components/events/searchBar';
import * as Layout from 'app/components/layouts/thirds';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import * as TeamKeyTransactionManager from 'app/components/performance/teamKeyTransactionsManager';
import {IconChevron} from 'app/icons';
import {IconFlag} from 'app/icons/iconFlag';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project, Team} from 'app/types';
import {generateQueryWithTag} from 'app/utils';
import EventView from 'app/utils/discover/eventView';
import {WebVital} from 'app/utils/discover/fields';
import {decodeScalar} from 'app/utils/queryString';
import {tokenizeSearch} from 'app/utils/tokenizeSearch';
import withProjects from 'app/utils/withProjects';
import withTeams from 'app/utils/withTeams';

import Breadcrumb from '../breadcrumb';
import {getTransactionSearchQuery} from '../utils';

import Table from './table';
import {vitalDescription, vitalMap} from './utils';
import VitalChart from './vitalChart';
import VitalInfo from './vitalInfo';

const FRONTEND_VITALS = [WebVital.FCP, WebVital.LCP, WebVital.FID, WebVital.CLS];

type Props = {
  location: Location;
  eventView: EventView;
  organization: Organization;
  projects: Project[];
  teams: Team[];
  router: InjectedRouter;

  vitalName: WebVital;
};

type State = {
  incompatibleAlertNotice: React.ReactNode;
  error: string | undefined;
};

function getSummaryConditions(query: string) {
  const parsed = tokenizeSearch(query);
  parsed.query = [];

  return parsed.formatString();
}

class VitalDetailContent extends React.Component<Props, State> {
  state: State = {
    incompatibleAlertNotice: null,
    error: undefined,
  };

  handleSearch = (query: string) => {
    const {location} = this.props;

    const queryParams = getParams({
      ...(location.query || {}),
      query,
    });

    // do not propagate pagination when making a new search
    const searchQueryParams = omit(queryParams, 'cursor');

    browserHistory.push({
      pathname: location.pathname,
      query: searchQueryParams,
    });
  };

  generateTagUrl = (key: string, value: string) => {
    const {location} = this.props;
    const query = generateQueryWithTag(location.query, {key, value});

    return {
      ...location,
      query,
    };
  };

  handleIncompatibleQuery: React.ComponentProps<
    typeof CreateAlertFromViewButton
  >['onIncompatibleQuery'] = (incompatibleAlertNoticeFn, _errors) => {
    const incompatibleAlertNotice = incompatibleAlertNoticeFn(() =>
      this.setState({incompatibleAlertNotice: null})
    );
    this.setState({incompatibleAlertNotice});
  };

  renderCreateAlertButton() {
    const {eventView, organization, projects} = this.props;

    return (
      <CreateAlertFromViewButton
        eventView={eventView}
        organization={organization}
        projects={projects}
        onIncompatibleQuery={this.handleIncompatibleQuery}
        onSuccess={() => {}}
        referrer="performance"
      />
    );
  }

  renderVitalSwitcher() {
    const {vitalName, location} = this.props;

    const position = FRONTEND_VITALS.indexOf(vitalName);

    if (position < 0) {
      return null;
    }

    const previousDisabled = position === 0;
    const nextDisabled = position === FRONTEND_VITALS.length - 1;

    const switchVital = newVitalName => {
      return () => {
        browserHistory.push({
          pathname: location.pathname,
          query: {
            ...location.query,
            vitalName: newVitalName,
          },
        });
      };
    };

    return (
      <ButtonBar merged>
        <Button
          icon={<IconChevron direction="left" size="sm" />}
          aria-label={t('Previous')}
          disabled={previousDisabled}
          onClick={switchVital(FRONTEND_VITALS[position - 1])}
        />
        <Button
          icon={<IconChevron direction="right" size="sm" />}
          aria-label={t('Next')}
          disabled={nextDisabled}
          onClick={switchVital(FRONTEND_VITALS[position + 1])}
        />
      </ButtonBar>
    );
  }

  setError = (error: string | undefined) => {
    this.setState({error});
  };

  renderError() {
    const {error} = this.state;

    if (!error) {
      return null;
    }

    return (
      <Alert type="error" icon={<IconFlag size="md" />}>
        {error}
      </Alert>
    );
  }

  render() {
    const {location, eventView, organization, vitalName, projects, teams} = this.props;
    const {incompatibleAlertNotice} = this.state;
    const query = decodeScalar(location.query.query, '');

    const vital = vitalName || WebVital.LCP;

    const filterString = getTransactionSearchQuery(location);
    const summaryConditions = getSummaryConditions(filterString);
    const description = vitalDescription[vitalName];
    const userTeams = teams.filter(({isMember}) => isMember);

    return (
      <React.Fragment>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumb
              organization={organization}
              location={location}
              vitalName={vital}
            />
            <Layout.Title>{vitalMap[vital]}</Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <ButtonBar gap={1}>
              <Feature organization={organization} features={['incidents']}>
                {({hasFeature}) => hasFeature && this.renderCreateAlertButton()}
              </Feature>
              {this.renderVitalSwitcher()}
            </ButtonBar>
          </Layout.HeaderActions>
        </Layout.Header>
        <Layout.Body>
          {this.renderError()}
          {incompatibleAlertNotice && (
            <Layout.Main fullWidth>{incompatibleAlertNotice}</Layout.Main>
          )}
          <Layout.Main fullWidth>
            <StyledDescription>{description}</StyledDescription>
            <StyledSearchBar
              searchSource="performance_vitals"
              organization={organization}
              projectIds={eventView.project}
              query={query}
              fields={eventView.fields}
              onSearch={this.handleSearch}
            />
            <VitalChart
              organization={organization}
              query={eventView.query}
              project={eventView.project}
              environment={eventView.environment}
              start={eventView.start}
              end={eventView.end}
              statsPeriod={eventView.statsPeriod}
            />
            <StyledVitalInfo>
              <VitalInfo
                eventView={eventView}
                organization={organization}
                location={location}
                vital={vital}
              />
            </StyledVitalInfo>
            <TeamKeyTransactionManager.Provider
              organization={organization}
              teams={userTeams}
              selectedTeams={['myteams']}
              selectedProjects={eventView.project.map(String)}
            >
              <Table
                eventView={eventView}
                projects={projects}
                organization={organization}
                location={location}
                setError={this.setError}
                summaryConditions={summaryConditions}
              />
            </TeamKeyTransactionManager.Provider>
          </Layout.Main>
        </Layout.Body>
      </React.Fragment>
    );
  }
}

const StyledDescription = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(3)};
`;

const StyledSearchBar = styled(SearchBar)`
  margin-bottom: ${space(2)};
`;

const StyledVitalInfo = styled('div')`
  margin-bottom: ${space(3)};
`;

export default withTeams(withProjects(VitalDetailContent));
