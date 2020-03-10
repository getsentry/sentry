import React from 'react';
import {Params} from 'react-router/lib/Router';
import * as ReactRouter from 'react-router';
import {Location} from 'history';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {PageContent} from 'app/styles/organization';
import EventView from 'app/views/eventsV2/eventView';
import {decodeScalar} from 'app/views/eventsV2/utils';
import {stringifyQueryObject} from 'app/utils/tokenizeSearch';
import NoProjectMessage from 'app/components/noProjectMessage';

import {generatePerformanceEventView} from '../data';
import SummaryContent from './content';

type Props = {
  location: Location;
  params: Params;
  organization: Organization;
  projects: Project[];
  loadingProjects: boolean;
};

type State = {
  eventView: EventView;
};

class TransactionSummary extends React.Component<Props, State> {
  state: State = {
    eventView: generateSummaryEventView(
      this.props.location,
      getTransactionName(this.props)
    ),
  };

  static getDerivedStateFromProps(nextProps: Props, prevState: State): State {
    return {
      ...prevState,
      eventView: generateSummaryEventView(
        nextProps.location,
        getTransactionName(nextProps)
      ),
    };
  }

  getDocumentTitle(): string {
    const name = getTransactionName(this.props);

    const hasTransactionName = typeof name === 'string' && String(name).trim().length > 0;

    if (hasTransactionName) {
      return [String(name).trim(), t('Performance')].join(' - ');
    }

    return [t('Summary'), t('Performance')].join(' - ');
  }

  render() {
    const {organization, location} = this.props;
    const {eventView} = this.state;

    const transactionName = getTransactionName(this.props);

    if (!transactionName) {
      // If there is no transaction name, redirect to the Performance landing page

      ReactRouter.browserHistory.replace({
        pathname: `/organizations/${organization.slug}/performance/`,
        query: {
          ...location.query,
        },
      });
      return null;
    }

    return (
      <SentryDocumentTitle title={this.getDocumentTitle()} objSlug={organization.slug}>
        <React.Fragment>
          <GlobalSelectionHeader organization={organization} />
          <StyledPageContent>
            <NoProjectMessage organization={organization}>
              <SummaryContent
                location={location}
                organization={organization}
                eventView={eventView}
                transactionName={transactionName}
              />
            </NoProjectMessage>
          </StyledPageContent>
        </React.Fragment>
      </SentryDocumentTitle>
    );
  }
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

function getTransactionName(props: Props): string | undefined {
  const {location} = props;
  const {transaction} = location.query;

  return decodeScalar(transaction);
}

function generateSummaryEventView(
  location: Location,
  transactionName: string | undefined
): EventView {
  let eventView = generatePerformanceEventView(location);

  if (typeof transactionName !== 'string') {
    return eventView;
  }

  // narrow the search conditions of the Performance event view

  eventView.name = transactionName;

  const searchConditions = {
    query: [],
    'event.type': ['transaction'],
    transaction: [transactionName],
  };

  eventView.query = stringifyQueryObject(searchConditions);

  eventView = eventView.withColumns([
    {
      aggregation: '',
      field: 'transaction',
    },
    {
      aggregation: 'rpm',
      field: '',
    },
    {
      aggregation: '',
      field: 'transaction.duration',
    },
    {
      aggregation: 'last_seen',
      field: '',
    },
  ]);

  eventView.sorts = [
    {
      kind: 'desc',
      field: 'transaction.duration',
    },
  ];

  return eventView;
}

export default withProjects(withOrganization(TransactionSummary));
