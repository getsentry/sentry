import {Component} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptorObject} from 'history';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import moment from 'moment-timezone';

import type {DateTimeObject} from 'sentry/components/charts/utils';
import {CompactSelect} from 'sentry/components/compactSelect';
import ErrorBoundary from 'sentry/components/errorBoundary';
import HookOrDefault from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {DATA_CATEGORY_INFO, DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {
  DataCategoryExact,
  type DataCategoryInfo,
  type PageFilters,
} from 'sentry/types/core';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {hasDynamicSamplingCustomFeature} from 'sentry/utils/dynamicSampling/features';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import HeaderTabs from 'sentry/views/organizationStats/header';
import {getPerformanceBaseUrl} from 'sentry/views/performance/utils';

import type {ChartDataTransform} from './usageChart';
import {CHART_OPTIONS_DATACATEGORY} from './usageChart';
import UsageStatsOrg from './usageStatsOrg';
import UsageStatsProjects from './usageStatsProjects';

const HookHeader = HookOrDefault({hookName: 'component:org-stats-banner'});

export const PAGE_QUERY_PARAMS = [
  // From DatePageFilter
  'statsPeriod',
  'start',
  'end',
  'utc',
  // From data category selector
  'dataCategory',
  // From UsageOrganizationStats
  'transform',
  // From UsageProjectStats
  'sort',
  'query',
  'cursor',
  'spikeCursor',
  // From show data discarded on client toggle
  'clientDiscard',
];

export type OrganizationStatsProps = {
  organization: Organization;
  selection: PageFilters;
} & RouteComponentProps;

export class OrganizationStats extends Component<OrganizationStatsProps> {
  get dataCategoryInfo(): DataCategoryInfo {
    const dataCategoryPlural = this.props.location?.query?.dataCategory;

    const categories = Object.values(DATA_CATEGORY_INFO);
    const info = categories.find(c => c.plural === dataCategoryPlural);

    if (
      info?.name === DataCategoryExact.SPAN &&
      this.props.organization.features.includes('spans-usage-tracking') &&
      !hasDynamicSamplingCustomFeature(this.props.organization)
    ) {
      return {
        ...info,
        apiName: 'span_indexed',
      };
    }

    // Default to errors
    return info ?? DATA_CATEGORY_INFO.error;
  }

  get dataCategory() {
    return this.dataCategoryInfo.plural;
  }

  get dataCategoryName() {
    return this.dataCategoryInfo.titleName;
  }

  get dataDatetime(): DateTimeObject {
    const params = this.props.selection.datetime;

    const {
      start,
      end,
      statsPeriod,
      utc: utcString,
    } = normalizeDateTimeParams(params, {
      allowEmptyPeriod: true,
      allowAbsoluteDatetime: true,
      allowAbsolutePageDatetime: true,
    });

    if (!statsPeriod && !start && !end) {
      return {period: DEFAULT_STATS_PERIOD};
    }

    // Following getParams, statsPeriod will take priority over start/end
    if (statsPeriod) {
      return {period: statsPeriod};
    }

    const utc = utcString === 'true';
    if (start && end) {
      return utc
        ? {
            start: moment.utc(start).format(),
            end: moment.utc(end).format(),
            utc,
          }
        : {
            start: moment(start).utc().format(),
            end: moment(end).utc().format(),
            utc,
          };
    }

    return {period: DEFAULT_STATS_PERIOD};
  }

  get clientDiscard(): boolean {
    return this.props.location?.query?.clientDiscard === 'true';
  }

  // Validation and type-casting should be handled by chart
  get chartTransform(): string | undefined {
    return this.props.location?.query?.transform;
  }

  // Validation and type-casting should be handled by table
  get tableSort(): string | undefined {
    return this.props.location?.query?.sort;
  }

  get tableQuery(): string | undefined {
    return this.props.location?.query?.query;
  }

  get tableCursor(): string | undefined {
    return this.props.location?.query?.cursor;
  }

  // Project selection from GlobalSelectionHeader
  get projectIds(): number[] {
    const selection_projects = this.props.selection.projects.length
      ? this.props.selection.projects
      : [ALL_ACCESS_PROJECTS];
    return selection_projects;
  }

  get isSingleProject(): boolean {
    return this.projectIds.length === 1 && !this.projectIds.includes(-1);
  }

  getNextLocations = (project: Project): Record<string, LocationDescriptorObject> => {
    const {location, organization} = this.props;
    const nextLocation: LocationDescriptorObject = {
      ...location,
      query: {
        ...location.query,
        project: project.id,
      },
    };

    // Do not leak out page-specific keys
    nextLocation.query = omit(nextLocation.query, PAGE_QUERY_PARAMS);

    return {
      performance: {
        ...nextLocation,
        pathname: getPerformanceBaseUrl(organization.slug),
      },
      projectDetail: {
        ...nextLocation,
        pathname: `/organizations/${organization.slug}/projects/${project.slug}/`,
      },
      issueList: {
        ...nextLocation,
        pathname: `/organizations/${organization.slug}/issues/`,
      },
      settings: {
        pathname: `/settings/${organization.slug}/projects/${project.slug}/`,
      },
    };
  };

  /**
   * See PAGE_QUERY_PARAMS for list of accepted keys on nextState
   */
  setStateOnUrl = (
    nextState: {
      clientDiscard?: boolean;
      cursor?: string;
      dataCategory?: DataCategoryInfo['plural'];
      query?: string;
      sort?: string;
      transform?: ChartDataTransform;
    },
    options: {
      willUpdateRouter?: boolean;
    } = {
      willUpdateRouter: true,
    }
  ): LocationDescriptorObject => {
    const {location, router} = this.props;
    const nextQueryParams = pick(nextState, PAGE_QUERY_PARAMS);

    const nextLocation = {
      ...location,
      query: {
        ...location?.query,
        ...nextQueryParams,
      },
    };

    if (options.willUpdateRouter) {
      router.push(nextLocation);
    }

    return nextLocation;
  };

  renderProjectPageControl = () => {
    const {organization} = this.props;

    const isSelfHostedErrorsOnly = ConfigStore.get('isSelfHostedErrorsOnly');

    const options = CHART_OPTIONS_DATACATEGORY.filter(opt => {
      if (isSelfHostedErrorsOnly) {
        return opt.value === DATA_CATEGORY_INFO.error.plural;
      }
      if (opt.value === DATA_CATEGORY_INFO.replay.plural) {
        return organization.features.includes('session-replay');
      }
      if (DATA_CATEGORY_INFO.span.plural === opt.value) {
        return organization.features.includes('span-stats');
      }
      if (DATA_CATEGORY_INFO.transaction.plural === opt.value) {
        return !organization.features.includes('spans-usage-tracking');
      }
      if (DATA_CATEGORY_INFO.profileDuration.plural === opt.value) {
        return (
          organization.features.includes('continuous-profiling-stats') ||
          organization.features.includes('continuous-profiling')
        );
      }
      if (DATA_CATEGORY_INFO.profile.plural === opt.value) {
        return !organization.features.includes('continuous-profiling-stats');
      }
      return true;
    });

    return (
      <PageControl>
        <PageFilterBar>
          <ProjectPageFilter />
          <DropdownDataCategory
            triggerProps={{prefix: t('Category')}}
            value={this.dataCategory}
            options={options}
            onChange={opt => this.setStateOnUrl({dataCategory: String(opt.value)})}
          />
          <DatePageFilter />
        </PageFilterBar>
      </PageControl>
    );
  };

  /**
   * This method is replaced by the hook "component:enhanced-org-stats"
   */
  renderUsageStatsOrg() {
    const {organization, router, location, params, routes} = this.props;
    return (
      <UsageStatsOrg
        isSingleProject={this.isSingleProject}
        projectIds={this.projectIds}
        organization={organization}
        dataCategory={this.dataCategory}
        dataCategoryName={this.dataCategoryInfo.titleName}
        dataCategoryApiName={this.dataCategoryInfo.apiName}
        dataDatetime={this.dataDatetime}
        chartTransform={this.chartTransform}
        clientDiscard={this.clientDiscard}
        handleChangeState={this.setStateOnUrl}
        router={router}
        location={location}
        params={params}
        routes={routes}
      />
    );
  }

  render() {
    const {organization} = this.props;
    const hasTeamInsights = organization.features.includes('team-insights');

    return (
      <SentryDocumentTitle title={t('Usage Stats')} orgSlug={organization.slug}>
        <NoProjectMessage organization={organization}>
          <PageFiltersContainer>
            {hasTeamInsights ? (
              <HeaderTabs organization={organization} activeTab="stats" />
            ) : (
              <Layout.Header>
                <Layout.HeaderContent>
                  <Layout.Title>{t('Organization Usage Stats')}</Layout.Title>
                  <HeadingSubtitle>
                    {tct(
                      'A view of the usage data that Sentry has received across your entire organization. [link: Read the docs].',
                      {
                        link: (
                          <ExternalLink href="https://docs.sentry.io/product/stats/" />
                        ),
                      }
                    )}
                  </HeadingSubtitle>
                </Layout.HeaderContent>
              </Layout.Header>
            )}
            <Body>
              <Layout.Main fullWidth>
                <HookHeader organization={organization} />
                {this.renderProjectPageControl()}
                <div>
                  <ErrorBoundary mini>{this.renderUsageStatsOrg()}</ErrorBoundary>
                </div>
                <ErrorBoundary mini>
                  <UsageStatsProjects
                    organization={organization}
                    dataCategory={this.dataCategoryInfo}
                    dataCategoryName={this.dataCategoryInfo.titleName}
                    isSingleProject={this.isSingleProject}
                    projectIds={this.projectIds}
                    dataDatetime={this.dataDatetime}
                    tableSort={this.tableSort}
                    tableQuery={this.tableQuery}
                    tableCursor={this.tableCursor}
                    handleChangeState={this.setStateOnUrl}
                    getNextLocations={this.getNextLocations}
                  />
                </ErrorBoundary>
              </Layout.Main>
            </Body>
          </PageFiltersContainer>
        </NoProjectMessage>
      </SentryDocumentTitle>
    );
  }
}

const HookOrgStats = HookOrDefault({
  hookName: 'component:enhanced-org-stats',
  defaultComponent: OrganizationStats,
});

export default withPageFilters(withOrganization(HookOrgStats));

const DropdownDataCategory = styled(CompactSelect)`
  width: auto;
  position: relative;
  grid-column: auto / span 1;

  button[aria-haspopup='listbox'] {
    width: 100%;
    height: 100%;
  }

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-column: auto / span 2;
  }
  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-column: auto / span 1;
  }

  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    pointer-events: none;
    box-shadow: inset 0 0 0 1px ${p => p.theme.border};
    border-radius: ${p => p.theme.borderRadius};
  }
`;

const Body = styled(Layout.Body)`
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    display: block;
  }
`;

const HeadingSubtitle = styled('p')`
  margin-top: ${space(0.5)};
  margin-bottom: 0;
`;

const PageControl = styled('div')`
  display: grid;
  width: 100%;
  margin-bottom: ${space(2)};
  grid-template-columns: minmax(0, max-content);
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;
