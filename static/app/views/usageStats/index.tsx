import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {LocationDescriptorObject} from 'history';
import omit from 'lodash/omit';
import pick from 'lodash/pick';

import {DateTimeObject} from 'app/components/charts/utils';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import ErrorBoundary from 'app/components/errorBoundary';
import PageHeading from 'app/components/pageHeading';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {DEFAULT_RELATIVE_PERIODS, DEFAULT_STATS_PERIOD} from 'app/constants';
import {t} from 'app/locale';
import {PageContent, PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';
import {
  DataCategory,
  DataCategoryName,
  Organization,
  Project,
  RelativePeriod,
} from 'app/types';
import {parsePeriodToHours} from 'app/utils/dates';

import {CHART_OPTIONS_DATACATEGORY, ChartDataTransform} from './usageChart';
import UsageStatsOrg from './usageStatsOrg';
import UsageStatsProjects from './usageStatsProjects';

const PAGE_QUERY_PARAMS = [
  'pageStart',
  'pageEnd',
  'pagePeriod',
  'pageUtc',
  'dataCategory',
  'transform',
  'sort',
  'query',
  'cursor',
];

type Props = {
  organization: Organization;
} & RouteComponentProps<{orgId: string}, {}>;

class OrganizationStats extends React.Component<Props> {
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
    return DataCategoryName[dataCategory] ?? t('Unknown Data Category');
  }

  get dataPeriod(): DateTimeObject {
    const {pagePeriod, pageStart, pageEnd} = this.props.location?.query ?? {};
    if (!pagePeriod && !pageStart && !pageEnd) {
      return {period: DEFAULT_STATS_PERIOD};
    }

    // Absolute date range is more specific than period
    if (pageStart && pageEnd) {
      return {start: pageStart, end: pageEnd};
    }

    const keys = Object.keys(DEFAULT_RELATIVE_PERIODS);
    return pagePeriod && keys.includes(pagePeriod)
      ? {period: pagePeriod}
      : {period: DEFAULT_STATS_PERIOD};
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
   * TODO: Enable user to set dateStart/dateEnd
   *
   * See PAGE_QUERY_PARAMS for list of accepted keys on nextState
   */
  setStateOnUrl = (
    nextState: {
      dataCategory?: DataCategory;
      pagePeriod?: RelativePeriod;
      transform?: ChartDataTransform;
      sort?: string;
      query?: string;
      cursor?: string;
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

  renderPageControl() {
    const {period} = this.dataPeriod;

    // Remove options for relative periods shorter than 1 week
    const relativePeriods = Object.keys(DEFAULT_RELATIVE_PERIODS).reduce((acc, key) => {
      const periodDays = parsePeriodToHours(key) / 24;
      if (periodDays >= 7) {
        acc[key] = DEFAULT_RELATIVE_PERIODS[key];
      }
      return acc;
    }, {});

    return (
      <React.Fragment>
        <DropdownDataCategory
          label={
            <DropdownLabel>
              <span>{t('Usage Metrics: ')}</span>
              <span>{this.dataCategoryName}</span>
            </DropdownLabel>
          }
        >
          {CHART_OPTIONS_DATACATEGORY.map(option => (
            <DropdownItem
              key={option.value}
              eventKey={option.value}
              onSelect={(val: string) =>
                this.setStateOnUrl({dataCategory: val as DataCategory})
              }
            >
              {option.label}
            </DropdownItem>
          ))}
        </DropdownDataCategory>
        <DropdownDate
          label={
            <DropdownLabel>
              <span>{t('Date Range: ')}</span>
              <span>{DEFAULT_RELATIVE_PERIODS[period || DEFAULT_STATS_PERIOD]}</span>
            </DropdownLabel>
          }
        >
          {Object.keys(relativePeriods).map(key => (
            <DropdownItem
              key={key}
              eventKey={key}
              onSelect={(val: string) =>
                this.setStateOnUrl({pagePeriod: val as RelativePeriod})
              }
            >
              {DEFAULT_RELATIVE_PERIODS[key]}
            </DropdownItem>
          ))}
        </DropdownDate>
      </React.Fragment>
    );
  }

  render() {
    const {organization} = this.props;

    return (
      <SentryDocumentTitle title="Usage Stats">
        <PageContent>
          <PageHeader>
            <PageHeading>{t('Organization Usage Stats')}</PageHeading>
          </PageHeader>

          <p>
            {t(
              'We collect usage metrics on three types of events: errors, transactions and attachments. The charts below reflect events that Sentry have received across your entire organization. You can also find them broken down by project in the table.'
            )}
          </p>

          <PageGrid>
            {this.renderPageControl()}

            <ErrorBoundary mini>
              <UsageStatsOrg
                organization={organization}
                dataCategory={this.dataCategory}
                dataCategoryName={this.dataCategoryName}
                dataDatetime={this.dataPeriod}
                chartTransform={this.chartTransform}
                handleChangeState={this.setStateOnUrl}
              />
            </ErrorBoundary>
            <ErrorBoundary mini>
              <UsageStatsProjects
                organization={organization}
                dataCategory={this.dataCategory}
                dataCategoryName={this.dataCategoryName}
                dataDatetime={this.dataPeriod}
                tableSort={this.tableSort}
                tableQuery={this.tableQuery}
                tableCursor={this.tableCursor}
                handleChangeState={this.setStateOnUrl}
                getNextLocations={this.getNextLocations}
              />
            </ErrorBoundary>
          </PageGrid>
        </PageContent>
      </SentryDocumentTitle>
    );
  }
}

export default OrganizationStats;

const PageGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  grid-gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: repeat(4, 1fr);
  }
`;

const StyledDropdown = styled(DropdownControl)`
  button {
    width: 100%;

    > span {
      display: flex;
      justify-content: space-between;
    }
  }
`;
const DropdownDataCategory = styled(StyledDropdown)`
  grid-column: auto / span 1;

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-column: auto / span 3;
  }
`;
const DropdownDate = styled(StyledDropdown)`
  grid-column: auto / span 1;
`;

const DropdownLabel = styled('span')`
  min-width: 100px;
  text-align: left;

  > span:last-child {
    font-weight: 400;
  }
`;
