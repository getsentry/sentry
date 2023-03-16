import {Component} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {LocationDescriptorObject} from 'history';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import moment from 'moment';

import {DateTimeObject} from 'sentry/components/charts/utils';
import {CompactSelect} from 'sentry/components/compactSelect';
import DatePageFilter from 'sentry/components/datePageFilter';
import ErrorBoundary from 'sentry/components/errorBoundary';
import HookOrDefault from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ChangeData} from 'sentry/components/organizations/timeRangeSelector';
import PageTimeRangeSelector from 'sentry/components/pageTimeRangeSelector';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {
  DATA_CATEGORY_INFO,
  DEFAULT_RELATIVE_PERIODS,
  DEFAULT_STATS_PERIOD,
} from 'sentry/constants';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  DataCategoryInfo,
  DateString,
  Organization,
  PageFilters,
  Project,
} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import HeaderTabs from 'sentry/views/organizationStats/header';

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
  // TODO(Leander): Remove date selector props once project-stats flag is GA
  'pageEnd',
  'pageStart',
  'pageStatsPeriod',
  'pageStatsUtc',
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
} & RouteComponentProps<{}, {}>;

const UsageStatsOrganization = HookOrDefault({
  hookName: 'component:enhanced-org-stats',
  defaultComponent: UsageStatsOrg,
});

export class OrganizationStats extends Component<Props> {
  get dataCategory(): DataCategoryInfo['plural'] {
    const dataCategory = this.props.location?.query?.dataCategory;

    switch (dataCategory) {
      case DATA_CATEGORY_INFO.error.plural:
      case DATA_CATEGORY_INFO.transaction.plural:
      case DATA_CATEGORY_INFO.attachment.plural:
      case DATA_CATEGORY_INFO.profile.plural:
      case DATA_CATEGORY_INFO.replay.plural:
        return dataCategory;
      default:
        return DATA_CATEGORY_INFO.error.plural;
    }
  }

  get dataCategoryInfo(): DataCategoryInfo {
    const dataCategoryPlural = this.props.location?.query?.dataCategory;
    const dataCategoryInfo =
      Object.values(DATA_CATEGORY_INFO).find(
        categoryInfo => categoryInfo.plural === dataCategoryPlural
      ) ?? DATA_CATEGORY_INFO.error;
    return dataCategoryInfo;
  }

  get dataCategoryName(): string {
    return this.dataCategoryInfo.titleName ?? t('Unknown Data Category');
  }

  get dataDatetime(): DateTimeObject {
    const params = this.hasProjectStats
      ? this.props.selection.datetime
      : this.props.location?.query ?? {};

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
    return this.hasProjectStats ? selection_projects : [ALL_ACCESS_PROJECTS];
  }

  /**
   * Note: Since we're not checking for 'global-views', orgs without that flag will only ever get
   * the single project view. This is a trade-off of using the global project header, but creates
   * product consistency, since multi-project selection should be controlled by this flag.
   */
  get hasProjectStats(): boolean {
    return this.props.organization.features.includes('project-stats');
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

  /**
   * See PAGE_QUERY_PARAMS for list of accepted keys on nextState
   */
  setStateOnUrl = (
    nextState: {
      cursor?: string;
      dataCategory?: DataCategoryInfo['plural'];
      // TODO(Leander): Remove date selector props once project-stats flag is GA
      pageEnd?: DateString;
      pageStart?: DateString;
      pageStatsPeriod?: string | null;
      pageStatsUtc?: string | null;
      pageUtc?: boolean | null;
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

    if (!this.hasProjectStats) {
      return null;
    }

    const hasReplay = organization.features.includes('session-replay');
    const options = hasReplay
      ? CHART_OPTIONS_DATACATEGORY
      : CHART_OPTIONS_DATACATEGORY.filter(
          opt => opt.value !== DATA_CATEGORY_INFO.replay.plural
        );

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
          <DatePageFilter alignDropdown="left" />
        </PageFilterBar>
      </PageControl>
    );
  };

  // TODO(Leander): Remove the following method once the project-stats flag is GA
  handleUpdateDatetime = (datetime: ChangeData): LocationDescriptorObject => {
    const {start, end, relative, utc} = datetime;

    if (start && end) {
      const parser = utc ? moment.utc : moment;

      return this.setStateOnUrl({
        pageStatsPeriod: undefined,
        pageStart: parser(start).format(),
        pageEnd: parser(end).format(),
        pageUtc: utc ?? undefined,
      });
    }

    return this.setStateOnUrl({
      pageStatsPeriod: relative || undefined,
      pageStart: undefined,
      pageEnd: undefined,
      pageUtc: undefined,
    });
  };

  // TODO(Leander): Remove the following method once the project-stats flag is GA
  renderPageControl = () => {
    const {organization} = this.props;
    if (this.hasProjectStats) {
      return null;
    }

    const {start, end, period, utc} = this.dataDatetime;

    const hasReplay = organization.features.includes('session-replay');
    const options = hasReplay
      ? CHART_OPTIONS_DATACATEGORY
      : CHART_OPTIONS_DATACATEGORY.filter(
          opt => opt.value !== DATA_CATEGORY_INFO.replay.plural
        );

    return (
      <SelectorGrid>
        <DropdownDataCategory
          triggerProps={{prefix: t('Category')}}
          value={this.dataCategory}
          options={options}
          onChange={opt => this.setStateOnUrl({dataCategory: String(opt.value)})}
        />

        <StyledPageTimeRangeSelector
          organization={organization}
          relative={period ?? ''}
          start={start ?? null}
          end={end ?? null}
          utc={utc ?? null}
          onUpdate={this.handleUpdateDatetime}
          relativeOptions={omit(DEFAULT_RELATIVE_PERIODS, ['1h'])}
        />
      </SelectorGrid>
    );
  };

  render() {
    const {organization} = this.props;
    const hasTeamInsights = organization.features.includes('team-insights');

    const isSingleProject = this.hasProjectStats
      ? this.projectIds.length === 1 && !this.projectIds.includes(-1)
      : false;

    return (
      <SentryDocumentTitle title="Usage Stats">
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
                      link: <ExternalLink href="https://docs.sentry.io/product/stats/" />,
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
              {this.renderPageControl()}
              <div>
                <ErrorBoundary mini>
                  <UsageStatsOrganization
                    organization={organization}
                    dataCategory={this.dataCategory}
                    dataCategoryName={this.dataCategoryName}
                    dataDatetime={this.dataDatetime}
                    chartTransform={this.chartTransform}
                    handleChangeState={this.setStateOnUrl}
                    projectIds={this.projectIds}
                    isSingleProject={isSingleProject}
                  />
                </ErrorBoundary>
              </div>
              <ErrorBoundary mini>
                {isSingleProject && (
                  <PanelHeading>
                    <Title>{t('All Projects')}</Title>
                  </PanelHeading>
                )}
                <UsageStatsProjects
                  organization={organization}
                  dataCategory={this.dataCategory}
                  dataCategoryName={this.dataCategoryName}
                  projectIds={isSingleProject ? [ALL_ACCESS_PROJECTS] : this.projectIds}
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
      </SentryDocumentTitle>
    );
  }
}

export default withPageFilters(withOrganization(OrganizationStats));

const SelectorGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${space(2)};
  margin-bottom: ${space(2)};
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: repeat(4, 1fr);
  }
`;

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

const StyledPageTimeRangeSelector = styled(PageTimeRangeSelector)`
  grid-column: auto / span 1;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-column: auto / span 2;
  }
  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-column: auto / span 3;
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

const Title = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.gray400};
  display: flex;
  flex: 1;
  align-items: center;
`;

const PanelHeading = styled('div')`
  display: flex;
  margin-bottom: ${space(2)};
  align-items: center;
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
