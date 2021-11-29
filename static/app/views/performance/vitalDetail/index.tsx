import {Component} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {loadOrganizationTags} from 'sentry/actionCreators/tags';
import {Client} from 'sentry/api';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import GlobalSelectionHeader from 'sentry/components/organizations/globalSelectionHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {GlobalSelection, Organization, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {WebVital} from 'sentry/utils/discover/fields';
import {PerformanceEventViewProvider} from 'sentry/utils/performance/contexts/performanceEventViewContext';
import {decodeScalar} from 'sentry/utils/queryString';
import withApi from 'sentry/utils/withApi';
import withGlobalSelection from 'sentry/utils/withGlobalSelection';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';

import {generatePerformanceVitalDetailView} from '../data';
import {addRoutePerformanceContext, getTransactionName} from '../utils';

import VitalDetailContent from './vitalDetailContent';

type Props = RouteComponentProps<{}, {}> & {
  api: Client;
  organization: Organization;
  projects: Project[];
  selection: GlobalSelection;
  loadingProjects: boolean;
};

type State = {
  eventView: EventView;
};

class VitalDetail extends Component<Props, State> {
  state: State = {
    eventView: generatePerformanceVitalDetailView(
      this.props.organization,
      this.props.location
    ),
  };

  static getDerivedStateFromProps(nextProps: Readonly<Props>, prevState: State): State {
    return {
      ...prevState,
      eventView: generatePerformanceVitalDetailView(
        nextProps.organization,
        nextProps.location
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

    return [t('Vital Detail'), t('Performance')].join(' - ');
  }

  render() {
    const {organization, location, router} = this.props;
    const {eventView} = this.state;
    if (!eventView) {
      browserHistory.replace({
        pathname: `/organizations/${organization.slug}/performance/`,
        query: {
          ...location.query,
        },
      });
      return null;
    }

    const vitalNameQuery = decodeScalar(location.query.vitalName);
    const vitalName =
      Object.values(WebVital).indexOf(vitalNameQuery as WebVital) === -1
        ? undefined
        : (vitalNameQuery as WebVital);

    return (
      <SentryDocumentTitle title={this.getDocumentTitle()} orgSlug={organization.slug}>
        <PerformanceEventViewProvider value={{eventView: this.state.eventView}}>
          <GlobalSelectionHeader>
            <StyledPageContent>
              <NoProjectMessage organization={organization}>
                <VitalDetailContent
                  location={location}
                  organization={organization}
                  eventView={eventView}
                  router={router}
                  vitalName={vitalName || WebVital.LCP}
                />
              </NoProjectMessage>
            </StyledPageContent>
          </GlobalSelectionHeader>
        </PerformanceEventViewProvider>
      </SentryDocumentTitle>
    );
  }
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

export default withApi(withGlobalSelection(withProjects(withOrganization(VitalDetail))));
