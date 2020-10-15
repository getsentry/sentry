import React from 'react';
import {Params} from 'react-router/lib/Router';
import {browserHistory} from 'react-router';
import {Location} from 'history';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {Client} from 'app/api';
import {t} from 'app/locale';
import {loadOrganizationTags} from 'app/actionCreators/tags';
import {Organization, Project, GlobalSelection} from 'app/types';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {PageContent} from 'app/styles/organization';
import EventView from 'app/utils/discover/eventView';
import {
  Column,
  WebVital,
  getAggregateAlias,
  isAggregateField,
} from 'app/utils/discover/fields';
import {decodeScalar} from 'app/utils/queryString';
import {tokenizeSearch, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import LoadingIndicator from 'app/components/loadingIndicator';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

import SummaryContent from './content';
import {addRoutePerformanceContext, getTransactionName} from '../utils';
import {PERCENTILE as VITAL_PERCENTILE} from '../realUserMonitoring/constants';

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
      getTransactionName(this.props.location)
    ),
  };

  static getDerivedStateFromProps(nextProps: Props, prevState: State): State {
    return {
      ...prevState,
      eventView: generateSummaryEventView(
        nextProps.location,
        getTransactionName(nextProps.location)
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

  getTotalsEventView(
    organization: Organization,
    eventView: EventView
  ): [EventView, TotalValues] {
    const threshold = organization.apdexThreshold.toString();

    const totalsView = eventView.withColumns([
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
      ...[WebVital.FP, WebVital.FCP, WebVital.LCP, WebVital.FID].map(
        vital =>
          ({
            kind: 'function',
            function: ['percentile', vital, VITAL_PERCENTILE.toString()],
          } as Column)
      ),
    ]);
    const emptyValues = totalsView.fields.reduce((values, field) => {
      values[getAggregateAlias(field.field)] = 0;
      return values;
    }, {});
    return [totalsView, emptyValues];
  }

  render() {
    const {organization, location} = this.props;
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
    const [totalsView, emptyValues] = this.getTotalsEventView(organization, eventView);

    return (
      <SentryDocumentTitle title={this.getDocumentTitle()} objSlug={organization.slug}>
        <GlobalSelectionHeader>
          <StyledPageContent>
            <LightWeightNoProjectMessage organization={organization}>
              <DiscoverQuery
                eventView={totalsView}
                orgSlug={organization.slug}
                location={location}
              >
                {({tableData, isLoading}) => {
                  if (isLoading) {
                    return <LoadingIndicator />;
                  }
                  const totals = (tableData && tableData.data.length
                    ? tableData.data[0]
                    : emptyValues) as TotalValues;
                  return (
                    <SummaryContent
                      location={location}
                      organization={organization}
                      eventView={eventView}
                      transactionName={transactionName}
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
  transactionName: string | undefined
): EventView | undefined {
  if (transactionName === undefined) {
    return undefined;
  }
  // Use the user supplied query but overwrite any transaction or event type
  // conditions they applied.
  const query = decodeScalar(location.query.query) || '';
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
      fields: ['id', 'user.display', 'transaction.duration', 'timestamp'],
      query: stringifyQueryObject(conditions),
      projects: [],
    },
    location
  );
}

export default withApi(
  withGlobalSelection(withProjects(withOrganization(TransactionSummary)))
);
