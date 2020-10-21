import { Component } from 'react';
import {Location} from 'history';
import {browserHistory, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import Alert from 'app/components/alert';
import Feature from 'app/components/acl/feature';
import Redirect from 'app/utils/redirect';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {Organization, Project, GlobalSelection} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {WebVital, isAggregateField} from 'app/utils/discover/fields';
import {decodeScalar} from 'app/utils/queryString';
import {tokenizeSearch, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

import {PERCENTILE, WEB_VITAL_DETAILS, VITAL_GROUPS} from './constants';
import RumContent from './content';
import {getTransactionName} from '../utils';
import {transactionSummaryRouteWithQuery} from '../transactionSummary/utils';

type Props = {
  location: Location;
  organization: Organization;
  projects: Project[];
  selection: GlobalSelection;
} & Pick<WithRouterProps, 'router'>;

type State = {
  eventView: EventView | undefined;
};

class TransactionVitals extends Component<Props> {
  state: State = {
    eventView: generateRumEventView(
      this.props.location,
      getTransactionName(this.props.location)
    ),
  };

  static getDerivedStateFromProps(nextProps: Props, prevState: State): State {
    return {
      ...prevState,
      eventView: generateRumEventView(
        nextProps.location,
        getTransactionName(nextProps.location)
      ),
    };
  }

  getDocumentTitle(): string {
    const name = getTransactionName(this.props.location);

    const hasTransactionName = typeof name === 'string' && String(name).trim().length > 0;

    if (hasTransactionName) {
      return [String(name).trim(), t('Vitals')].join(' \u2014 ');
    }

    return [t('Summary'), t('Vitals')].join(' \u2014 ');
  }

  renderNoAccess = () => {
    const {router, organization, location} = this.props;

    const hasFeature = organization.features.includes('performance-view');
    if (!hasFeature) {
      return <Alert type="warning">{t("You don't have access to this feature")}</Alert>;
    }

    const transactionName = getTransactionName(this.props.location);
    if (!transactionName) {
      // If there is no transaction name, redirect to the Performance landing page

      browserHistory.replace({
        pathname: `/organizations/${organization.slug}/performance/`,
        query: {
          ...location.query,
        },
      });
      return null;
    }

    return (
      <Redirect
        router={router}
        to={transactionSummaryRouteWithQuery({
          orgSlug: organization.slug,
          transaction: transactionName,
          projectID: decodeScalar(location.query.project),
          query: location.query,
        })}
      />
    );
  };

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

    return (
      <SentryDocumentTitle title={this.getDocumentTitle()} objSlug={organization.slug}>
        <Feature
          features={['measurements']}
          organization={organization}
          renderDisabled={this.renderNoAccess}
        >
          <GlobalSelectionHeader>
            <StyledPageContent>
              <LightWeightNoProjectMessage organization={organization}>
                <RumContent
                  location={location}
                  eventView={eventView}
                  transactionName={transactionName}
                  organization={organization}
                  projects={projects}
                />
              </LightWeightNoProjectMessage>
            </StyledPageContent>
          </GlobalSelectionHeader>
        </Feature>
      </SentryDocumentTitle>
    );
  }
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

function generateRumEventView(
  location: Location,
  transactionName: string | undefined
): EventView | undefined {
  if (transactionName === undefined) {
    return undefined;
  }
  const query = decodeScalar(location.query.query) || '';
  const conditions = tokenizeSearch(query);
  conditions
    .setTagValues('event.type', ['transaction'])
    .setTagValues('transaction.op', ['pageload'])
    .setTagValues('transaction', [transactionName]);

  Object.keys(conditions.tagValues).forEach(field => {
    if (isAggregateField(field)) conditions.removeTag(field);
  });

  const vitals = VITAL_GROUPS.reduce((allVitals: WebVital[], group) => {
    return allVitals.concat(group.vitals);
  }, []);

  return EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields: [
        ...vitals.map(vital => `percentile(${vital}, ${PERCENTILE})`),
        ...vitals.map(vital => `count_at_least(${vital}, 0)`),
        ...vitals.map(
          vital =>
            `count_at_least(${vital}, ${WEB_VITAL_DETAILS[vital].failureThreshold})`
        ),
      ],
      query: stringifyQueryObject(conditions),
      projects: [],
    },
    location
  );
}

export default withGlobalSelection(withProjects(withOrganization(TransactionVitals)));
