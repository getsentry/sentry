import React from 'react';
import {browserHistory} from 'react-router';
import {Params} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {loadOrganizationTags} from 'app/actionCreators/tags';
import {Client} from 'app/api';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {GlobalSelection, Organization, Project} from 'app/types';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {
  AggregationKey,
  Column,
  isAggregateField,
  WebVital,
} from 'app/utils/discover/fields';
import {decodeScalar} from 'app/utils/queryString';
import {stringifyQueryObject, tokenizeSearch} from 'app/utils/tokenizeSearch';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

import {
  PERCENTILE as VITAL_PERCENTILE,
  VITAL_GROUPS,
} from '../transactionVitals/constants';
import {addRoutePerformanceContext, getTransactionName} from '../utils';

import SummaryContent from './content';

type Props = {
  api: Client;
  location: Location;
  params: Params;
  organization: Organization;
  projects: Project[];
  selection: GlobalSelection;
  loadingProjects: boolean;
};

type State = {
  eventView: EventView | undefined;
};

// Used to cast the totals request to numbers
// as React.ReactText
type TotalValues = Record<string, number>;

class TransactionSummary extends React.Component<Props, State> {
  state: State = {
    eventView: generateSummaryEventView(
      this.props.location,
      getTransactionName(this.props.location),
      this.props.organization
    ),
  };

  static getDerivedStateFromProps(nextProps: Readonly<Props>, prevState: State): State {
    return {
      ...prevState,
      eventView: generateSummaryEventView(
        nextProps.location,
        getTransactionName(nextProps.location),
        nextProps.organization
      ),
    };
  }

  componentDidMount() {
    const {api, organization, selection} = this.props;
    loadOrganizationTags(api, organization.slug, selection);
    addRoutePerformanceContext(selection);
  }

  componentDidUpdate(prevProps: Props) {
    const {api, organization, selection} = this.props;

    if (
      !isEqual(prevProps.selection.projects, selection.projects) ||
      !isEqual(prevProps.selection.datetime, selection.datetime)
    ) {
      loadOrganizationTags(api, organization.slug, selection);
      addRoutePerformanceContext(selection);
    }
  }

  getDocumentTitle(): string {
    const name = getTransactionName(this.props.location);

    const hasTransactionName = typeof name === 'string' && String(name).trim().length > 0;

    if (hasTransactionName) {
      return [String(name).trim(), t('Performance')].join(' - ');
    }

    return [t('Summary'), t('Performance')].join(' - ');
  }

  getTotalsEventView(organization: Organization, eventView: EventView): EventView {
    const threshold = organization.apdexThreshold.toString();

    const vitals = VITAL_GROUPS.map(({vitals: vs}) => vs).reduce(
      (keys: WebVital[], vs) => {
        vs.forEach(vital => keys.push(vital));
        return keys;
      },
      []
    );

    return eventView.withColumns([
      {
        kind: 'function',
        function: ['apdex', threshold, undefined],
      },
      {
        kind: 'function',
        function: ['user_misery', threshold, undefined],
      },
      {
        kind: 'function',
        function: ['p95', '', undefined],
      },
      {
        kind: 'function',
        function: ['count', '', undefined],
      },
      {
        kind: 'function',
        function: ['count_unique', 'user', undefined],
      },
      {
        kind: 'function',
        function: ['failure_rate', '', undefined],
      },
      {
        kind: 'function',
        function: ['tpm', '', undefined],
      },
      {
        kind: 'function',
        function: ['user_misery_prototype' as AggregationKey, threshold, undefined],
      },
      ...vitals.map(
        vital =>
          ({
            kind: 'function',
            function: ['percentile', vital, VITAL_PERCENTILE.toString()],
          } as Column)
      ),
    ]);
  }

  render() {
    const {organization, projects, location} = this.props;
    const {eventView} = this.state;
    const transactionName = getTransactionName(location);
    if (!eventView || transactionName === undefined) {
      // If there is no transaction name, redirect to the Performance landing page

      browserHistory.replace({
        pathname: `/organizations/${organization.slug}/performance/`,
        query: {
          ...location.query,
        },
      });
      return null;
    }
    const totalsView = this.getTotalsEventView(organization, eventView);

    const shouldForceProject = eventView.project.length === 1;
    const forceProject = shouldForceProject
      ? projects.find(p => parseInt(p.id, 10) === eventView.project[0])
      : undefined;

    const projectSlugs = eventView.project
      .map(projectId => projects.find(p => parseInt(p.id, 10) === projectId))
      .filter((p: Project | undefined): p is Project => p !== undefined)
      .map(p => p.slug);

    return (
      <SentryDocumentTitle
        title={this.getDocumentTitle()}
        orgSlug={organization.slug}
        projectSlug={forceProject?.slug}
      >
        <GlobalSelectionHeader
          lockedMessageSubject={t('transaction')}
          shouldForceProject={shouldForceProject}
          forceProject={forceProject}
          specificProjectSlugs={projectSlugs}
          disableMultipleProjectSelection
          showProjectSettingsLink
        >
          <StyledPageContent>
            <LightWeightNoProjectMessage organization={organization}>
              <DiscoverQuery
                eventView={totalsView}
                orgSlug={organization.slug}
                location={location}
              >
                {({isLoading, error, tableData}) => {
                  const totals: TotalValues | null = tableData?.data?.[0] ?? null;
                  return (
                    <SummaryContent
                      location={location}
                      organization={organization}
                      eventView={eventView}
                      transactionName={transactionName}
                      isLoading={isLoading}
                      error={error}
                      totalValues={totals}
                    />
                  );
                }}
              </DiscoverQuery>
            </LightWeightNoProjectMessage>
          </StyledPageContent>
        </GlobalSelectionHeader>
      </SentryDocumentTitle>
    );
  }
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

function generateSummaryEventView(
  location: Location,
  transactionName: string | undefined,
  organization: Organization
): EventView | undefined {
  if (transactionName === undefined) {
    return undefined;
  }
  // Use the user supplied query but overwrite any transaction or event type
  // conditions they applied.
  const query = decodeScalar(location.query.query, '');
  const conditions = tokenizeSearch(query);
  conditions
    .setTagValues('event.type', ['transaction'])
    .setTagValues('transaction', [transactionName]);

  Object.keys(conditions.tagValues).forEach(field => {
    if (isAggregateField(field)) conditions.removeTag(field);
  });

  // Handle duration filters from the latency chart
  if (location.query.startDuration || location.query.endDuration) {
    conditions.setTagValues(
      'transaction.duration',
      [
        decodeScalar(location.query.startDuration),
        decodeScalar(location.query.endDuration),
      ]
        .filter(item => item)
        .map((item, index) => (index === 0 ? `>${item}` : `<${item}`))
    );
  }

  return EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields: organization.features.includes('trace-view-summary')
        ? ['id', 'user.display', 'transaction.duration', 'trace', 'timestamp']
        : ['id', 'user.display', 'transaction.duration', 'timestamp'],
      query: stringifyQueryObject(conditions),
      projects: [],
    },
    location
  );
}

export default withApi(
  withGlobalSelection(withProjects(withOrganization(TransactionSummary)))
);
