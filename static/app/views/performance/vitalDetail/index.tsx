import {Component} from 'react';
import isEqual from 'lodash/isEqual';

import {loadOrganizationTags} from 'sentry/actionCreators/tags';
import type {Client} from 'sentry/api';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import type EventView from 'sentry/utils/discover/eventView';
import {WebVital} from 'sentry/utils/fields';
import {PerformanceEventViewProvider} from 'sentry/utils/performance/contexts/performanceEventViewContext';
import {decodeScalar} from 'sentry/utils/queryString';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import withProjects from 'sentry/utils/withProjects';

import {generatePerformanceVitalDetailView} from '../data';
import {
  addRoutePerformanceContext,
  getPerformanceBaseUrl,
  getSelectedProjectPlatforms,
  getTransactionName,
} from '../utils';

import VitalDetailContent from './vitalDetailContent';

type Props = RouteComponentProps & {
  api: Client;
  loadingProjects: boolean;
  organization: Organization;
  projects: Project[];
  selection: PageFilters;
};

type State = {
  eventView: EventView;
};

class VitalDetail extends Component<Props, State> {
  state: State = {
    eventView: generatePerformanceVitalDetailView(
      this.props.location,
      this.props.organization
    ),
  };

  static getDerivedStateFromProps(nextProps: Readonly<Props>, prevState: State): State {
    return {
      ...prevState,
      eventView: generatePerformanceVitalDetailView(
        nextProps.location,
        nextProps.organization
      ),
    };
  }

  componentDidMount() {
    const {api, organization, selection, location, projects} = this.props;
    loadOrganizationTags(api, organization.slug, selection);
    addRoutePerformanceContext(selection);

    trackAnalytics('performance_views.vital_detail.view', {
      organization,
      project_platforms: getSelectedProjectPlatforms(location, projects),
    });
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
      return [String(name).trim(), t('Performance')].join(' — ');
    }

    return [t('Vital Detail'), t('Performance')].join(' — ');
  }

  render() {
    const {organization, location, router, api} = this.props;
    const {eventView} = this.state;
    if (!eventView) {
      browserHistory.replace(
        normalizeUrl({
          pathname: getPerformanceBaseUrl(organization.slug),
          query: {
            ...location.query,
          },
        })
      );
      return null;
    }

    const vitalNameQuery = decodeScalar(location.query.vitalName);
    const vitalName = !Object.values(WebVital).includes(vitalNameQuery as WebVital)
      ? undefined
      : (vitalNameQuery as WebVital);

    return (
      <SentryDocumentTitle title={this.getDocumentTitle()} orgSlug={organization.slug}>
        <PerformanceEventViewProvider value={{eventView: this.state.eventView}}>
          <PageFiltersContainer>
            <Layout.Page>
              <VitalDetailContent
                location={location}
                organization={organization}
                eventView={eventView}
                router={router}
                vitalName={vitalName || WebVital.LCP}
                api={api}
              />
            </Layout.Page>
          </PageFiltersContainer>
        </PerformanceEventViewProvider>
      </SentryDocumentTitle>
    );
  }
}

export default withApi(withPageFilters(withProjects(withOrganization(VitalDetail))));
