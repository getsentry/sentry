import {Component, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {LocationDescriptorObject} from 'history';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import moment from 'moment';

import {navigateTo} from 'sentry/actionCreators/navigation';
import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import {DateTimeObject} from 'sentry/components/charts/utils';
import DatePageFilter from 'sentry/components/datePageFilter';
import ErrorBoundary from 'sentry/components/errorBoundary';
import CompactSelect from 'sentry/components/forms/compactSelect';
import HookOrDefault from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import PageHeading from 'sentry/components/pageHeading';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {DATA_CATEGORY_NAMES, DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {PageHeader} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {DataCategory, Organization, PageFilters, Project} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import HeaderTabs from 'sentry/views/organizationStats/header';

import {SearchContainer} from '../issueList/filters';

import {CHART_OPTIONS_DATACATEGORY, ChartDataTransform} from './usageChart';
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
];

type Props = {
  organization: Organization;
  selection: PageFilters;
} & RouteComponentProps<{orgId: string}, {}>;

export class OrganizationStats extends Component<Props> {
  get dataCategory(): DataCategory {
    const dataCategory = this.props.location?.query?.dataCategory;

    switch (dataCategory) {
      case DataCategory.ERRORS:
      case DataCategory.TRANSACTIONS:
      case DataCategory.ATTACHMENTS:
        return dataCategory as DataCategory;
      default:
        return DataCategory.ERRORS;
    }
  }

  get dataCategoryName(): string {
    const dataCategory = this.dataCategory;
    return DATA_CATEGORY_NAMES[dataCategory] ?? t('Unknown Data Category');
  }

  get dataDatetime(): DateTimeObject {
    const {selection} = this.props;

    const {
      start,
      end,
      statsPeriod,
      utc: utcString,
    } = normalizeDateTimeParams(selection.datetime, {
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
    return this.props.selection.projects;
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
        pathname: `/organizations/${organization.slug}/performance/`,
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

  navigateToSamplingSettings = (e: React.MouseEvent) => {
    e.preventDefault?.();

    const {organization, router} = this.props;

    navigateTo(
      `/settings/${organization.slug}/projects/:projectId/server-side-sampling/?referrer=org-stats.alert`,
      router
    );
  };

  /**
   * See PAGE_QUERY_PARAMS for list of accepted keys on nextState
   */
  setStateOnUrl = (
    nextState: {
      cursor?: string;
      dataCategory?: DataCategory;
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

  renderPageControl = () => {
    return (
      <SearchContainer>
        <PageFilterBar>
          <ProjectPageFilter />
          <DropdownDataCategory
            triggerProps={{prefix: t('Category')}}
            value={this.dataCategory}
            options={CHART_OPTIONS_DATACATEGORY}
            onChange={opt =>
              this.setStateOnUrl({dataCategory: opt.value as DataCategory})
            }
          />
          <DatePageFilter alignDropdown="left" />
        </PageFilterBar>
      </SearchContainer>
    );
  };

  render() {
    const {organization} = this.props;
    const hasTeamInsights = organization.features.includes('team-insights');

    // We only show UsageProjectStats if multiple projects are selected
    const shouldRenderProjectStats =
      this.projectIds.includes(-1) || this.projectIds.length !== 1;

    return (
      <SentryDocumentTitle title="Usage Stats">
        <PageFiltersContainer>
          {hasTeamInsights && (
            <HeaderTabs organization={organization} activeTab="stats" />
          )}
          <Body>
            <Layout.Main fullWidth>
              {!hasTeamInsights && (
                <Fragment>
                  <PageHeader>
                    <PageHeading>{t('Organization Usage Stats')}</PageHeading>
                  </PageHeader>
                  <p>
                    {t(
                      'We collect usage metrics on three categories: errors, transactions, and attachments. The charts below reflect data that Sentry has received across your entire organization. You can also find them broken down by project in the table.'
                    )}
                  </p>
                </Fragment>
              )}
              <HookHeader organization={organization} />

              {this.renderPageControl()}
              <PageGrid>
                <ErrorBoundary mini>
                  <UsageStatsOrg
                    organization={organization}
                    dataCategory={this.dataCategory}
                    dataCategoryName={this.dataCategoryName}
                    dataDatetime={this.dataDatetime}
                    chartTransform={this.chartTransform}
                    handleChangeState={this.setStateOnUrl}
                    projectIds={this.projectIds}
                  />
                </ErrorBoundary>
              </PageGrid>
              <Feature
                features={['server-side-sampling', 'server-side-sampling-ui']}
                organization={organization}
              >
                {this.dataCategory === DataCategory.TRANSACTIONS && (
                  <Alert type="info" showIcon>
                    {tct(
                      'Manage your transaction usage in Dynamic Sampling. Go to [link: Dynamic Sampling Settings].',
                      {
                        link: <a href="#" onClick={this.navigateToSamplingSettings} />,
                      }
                    )}
                  </Alert>
                )}
              </Feature>
              {shouldRenderProjectStats && (
                <ErrorBoundary mini>
                  <UsageStatsProjects
                    organization={organization}
                    dataCategory={this.dataCategory}
                    dataCategoryName={this.dataCategoryName}
                    projectIds={this.projectIds}
                    dataDatetime={this.dataDatetime}
                    tableSort={this.tableSort}
                    tableQuery={this.tableQuery}
                    tableCursor={this.tableCursor}
                    handleChangeState={this.setStateOnUrl}
                    getNextLocations={this.getNextLocations}
                  />
                </ErrorBoundary>
              )}
            </Layout.Main>
          </Body>
        </PageFiltersContainer>
      </SentryDocumentTitle>
    );
  }
}

export default withPageFilters(withOrganization(OrganizationStats));

const PageGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: repeat(4, 1fr);
  }
`;

const DropdownDataCategory = styled(CompactSelect)`
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
`;

const Body = styled(Layout.Body)`
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    display: block;
  }
`;
