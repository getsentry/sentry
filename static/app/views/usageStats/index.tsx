import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {LocationDescriptorObject} from 'history';
import omit from 'lodash/omit';
import pick from 'lodash/pick';

import {SectionHeading} from 'app/components/charts/styles';
import {DateTimeObject, getInterval} from 'app/components/charts/utils';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import ErrorBoundary from 'app/components/errorBoundary';
import PageHeading from 'app/components/pageHeading';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {DEFAULT_RELATIVE_PERIODS, DEFAULT_STATS_PERIOD} from 'app/constants';
import {t, tct} from 'app/locale';
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
import UsageStatsLastMin from './UsageStatsLastMin';
import UsageStatsOrg from './usageStatsOrg';
import UsageStatsProjects from './usageStatsProjects';

const PAGE_QUERY_PARAMS = [
  'pageStart',
  'pageEnd',
  'pagePeriod',
  'pageUtc',
  'dataCategory',
  'chartTransform',
  'sort',
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
    return this.props.location?.query?.chartTransform;
  }

  // Validation and type-casting should be handled by table
  get tableSort(): string | undefined {
    return this.props.location?.query?.sort;
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
        pathname: `/organizations/${organization.slug}/projects/${project.slug}`,
      },
      issueList: {
        ...nextLocation,
        pathname: `/organizations/${organization.slug}/issues/`,
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
      chartTransform?: ChartDataTransform;
      sort?: string;
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
    const {organization} = this.props;

    // Might deviate from server-side but this is cosmetic at the moment
    const interval = getInterval(this.dataPeriod);
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
      <Header>
        <HeaderItemRow>
          <HeaderItemRow>
            <ItemPagePeriod>
              <SectionHeading>{t('Display')}</SectionHeading>
              <DropdownControl
                label={
                  <DropdownLabel>
                    {DEFAULT_RELATIVE_PERIODS[period || DEFAULT_STATS_PERIOD]}
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
              </DropdownControl>
            </ItemPagePeriod>

            <ItemDataCategory>
              <SectionHeadingInRow>{t('of')}</SectionHeadingInRow>
              <DropdownControl
                label={<DropdownLabel>{this.dataCategoryName}</DropdownLabel>}
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
              </DropdownControl>
            </ItemDataCategory>
          </HeaderItemRow>
          <HeaderItemColumn>
            <SectionHeading>{t('Interval')}</SectionHeading>
            <HeaderItemValue>
              <span>{interval}</span>
            </HeaderItemValue>
          </HeaderItemColumn>
        </HeaderItemRow>

        <ErrorBoundary mini>
          <UsageStatsLastMin
            organization={organization}
            dataCategory={this.dataCategory}
            dataCategoryName={this.dataCategoryName}
          />
        </ErrorBoundary>
      </Header>
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

          {this.renderPageControl()}

          <p>
            {t(
              'The chart below reflects events that Sentry has received across your entire organization. We collect usage metrics on three types of events: errors, transactions, and attachments. Sessions are not included in this chart.'
            )}
          </p>

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

          <PageHeader>
            <PageHeading>
              {tct('Project Usage Stats for [dataCategory]', {
                dataCategory: this.dataCategoryName,
              })}
            </PageHeading>
          </PageHeader>

          <p>{t('Only usage stats for your projects are displayed here.')}</p>

          <ErrorBoundary mini>
            <UsageStatsProjects
              organization={organization}
              dataCategory={this.dataCategory}
              dataCategoryName={this.dataCategoryName}
              dataDatetime={this.dataPeriod}
              tableSort={this.tableSort}
              handleChangeState={this.setStateOnUrl}
              getNextLocations={this.getNextLocations}
            />
          </ErrorBoundary>
        </PageContent>
      </SentryDocumentTitle>
    );
  }
}

export default OrganizationStats;

const Header = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: ${space(3)};
`;
const HeaderItem = styled('div')`
  display: flex;
  margin-right: ${space(3)};
`;
const HeaderItemRow = styled(HeaderItem)`
  flex-direction: row;
  align-items: flex-end;
  justify-content: flex-start;
`;
const HeaderItemColumn = styled(HeaderItem)`
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
`;
const HeaderItemValue = styled('div')`
  display: flex;
  align-items: center;
  min-height: 40px;

  > span {
    font-weight: 600;
    font-size: ${p => p.theme.fontSizeMedium};
    color: ${p => p.theme.gray500}; /* Make it same as dropdown */
  }
`;

const ItemPagePeriod = styled('div')`
  display: flex;
  flex-direction: column;
  margin-right: ${space(2)};
`;
const ItemDataCategory = styled('div')`
  display: flex;
  flex-direction: row;
  margin-right: ${space(2)};
`;
const SectionHeadingInRow = styled(SectionHeading)`
  margin-right: ${space(2)};
`;
const DropdownLabel = styled('span')`
  min-width: 100px;
  text-align: left;
`;
