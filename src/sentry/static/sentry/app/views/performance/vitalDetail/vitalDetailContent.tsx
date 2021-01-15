import React from 'react';
import {browserHistory, InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import omit from 'lodash/omit';

import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import ButtonBar from 'app/components/buttonBar';
import {CreateAlertFromViewButton} from 'app/components/createAlertButton';
import * as Layout from 'app/components/layouts/thirds';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {IconFlag} from 'app/icons/iconFlag';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {generateQueryWithTag} from 'app/utils';
import EventView from 'app/utils/discover/eventView';
import {WebVital} from 'app/utils/discover/fields';
import {decodeScalar} from 'app/utils/queryString';
import {stringifyQueryObject, tokenizeSearch} from 'app/utils/tokenizeSearch';
import withProjects from 'app/utils/withProjects';
import SearchBar from 'app/views/events/searchBar';

import Breadcrumb from '../breadcrumb';
import {getTransactionSearchQuery} from '../utils';

import Table from './table';
import {vitalDescription, vitalMap} from './utils';
import VitalChart from './vitalChart';
import VitalInfo from './vitalInfo';

type Props = {
  location: Location;
  eventView: EventView;
  organization: Organization;
  projects: Project[];
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

  return stringifyQueryObject(parsed);
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
    const {location, eventView, organization, vitalName, projects} = this.props;
    const {incompatibleAlertNotice} = this.state;
    const query = decodeScalar(location.query.query) || '';

    const vital = vitalName || WebVital.LCP;

    const filterString = getTransactionSearchQuery(location);
    const summaryConditions = getSummaryConditions(filterString);
    const description = vitalDescription[vitalName];

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
            <Table
              eventView={eventView}
              projects={projects}
              organization={organization}
              location={location}
              setError={this.setError}
              summaryConditions={summaryConditions}
            />
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

export default withProjects(VitalDetailContent);
