import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {LocationDescriptorObject} from 'history';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import moment from 'moment';

import {DateTimeObject} from 'app/components/charts/utils';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import ErrorBoundary from 'app/components/errorBoundary';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import TimeRangeSelector, {
  ChangeData,
} from 'app/components/organizations/timeRangeSelector';
import PageHeading from 'app/components/pageHeading';
import {Panel} from 'app/components/panels';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {DEFAULT_RELATIVE_PERIODS, DEFAULT_STATS_PERIOD} from 'app/constants';
import {t} from 'app/locale';
import {PageContent, PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';
import {
  DataCategory,
  DataCategoryName,
  DateString,
  Organization,
  Project,
  RelativePeriod,
} from 'app/types';

import {CHART_OPTIONS_DATACATEGORY, ChartDataTransform} from './usageChart';
import UsageStatsOrg from './usageStatsOrg';
import UsageStatsProjects from './usageStatsProjects';

const PAGE_QUERY_PARAMS = [
  'pageStatsPeriod',
  'pageStart',
  'pageEnd',
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

type State = {
  isCalendarOpen: boolean;
};

class OrganizationStats extends React.Component<Props, State> {
  state = {
    isCalendarOpen: false,
  };

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

  get dataDatetime(): DateTimeObject {
    const query = this.props.location?.query ?? {};

    const {start, end, statsPeriod, utc: utcString} = getParams(query, {
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
      pageStatsPeriod: (relative as RelativePeriod) || undefined,
      pageStart: undefined,
      pageEnd: undefined,
      pageUtc: undefined,
    });
  };

  /**
   * TODO: Enable user to set dateStart/dateEnd
   *
   * See PAGE_QUERY_PARAMS for list of accepted keys on nextState
   */
  setStateOnUrl = (
    nextState: {
      dataCategory?: DataCategory;
      pageStatsPeriod?: RelativePeriod;
      pageStart?: DateString;
      pageEnd?: DateString;
      pageUtc?: boolean | null;
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

  renderPageControl = () => {
    const {organization} = this.props;
    const {isCalendarOpen} = this.state;

    const {start, end, period, utc} = this.dataDatetime;

    return (
      <React.Fragment>
        <DropdownDate isCalendarOpen={isCalendarOpen}>
          <TimeRangeSelector
            organization={organization}
            relative={period ?? ''}
            start={start ?? null}
            end={end ?? null}
            utc={utc ?? null}
            label={<DropdownLabel>{t('Date Range:')}</DropdownLabel>}
            onChange={() => {}}
            onUpdate={this.handleUpdateDatetime}
            onToggleSelector={isOpen => this.setState({isCalendarOpen: isOpen})}
            relativeOptions={omit(DEFAULT_RELATIVE_PERIODS, ['1h'])}
            defaultPeriod={DEFAULT_STATS_PERIOD}
          />
        </DropdownDate>

        <DropdownDataCategory
          label={
            <DropdownLabel>
              <span>{t('Event Type: ')}</span>
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
      </React.Fragment>
    );
  };

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
              'We collect usage metrics on three types of events: errors, transactions, and attachments. The charts below reflect events that Sentry has received across your entire organization. You can also find them broken down by project in the table.'
            )}
          </p>

          <PageGrid>
            {this.renderPageControl()}

            <ErrorBoundary mini>
              <UsageStatsOrg
                organization={organization}
                dataCategory={this.dataCategory}
                dataCategoryName={this.dataCategoryName}
                dataDatetime={this.dataDatetime}
                chartTransform={this.chartTransform}
                handleChangeState={this.setStateOnUrl}
              />
            </ErrorBoundary>
            <ErrorBoundary mini>
              <UsageStatsProjects
                organization={organization}
                dataCategory={this.dataCategory}
                dataCategoryName={this.dataCategoryName}
                dataDatetime={this.dataDatetime}
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

const DropdownDataCategory = styled(DropdownControl)`
  height: 42px;
  grid-column: auto / span 1;
  justify-self: stretch;
  align-self: stretch;

  button {
    width: 100%;
    height: 100%;

    > span {
      display: flex;
      justify-content: space-between;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-column: auto / span 2;
  }
  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-column: auto / span 1;
  }
`;

const DropdownDate = styled(Panel)<{isCalendarOpen: boolean}>`
  grid-column: auto / span 1;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 42px;

  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p =>
    p.isCalendarOpen
      ? `${p.theme.borderRadius} ${p.theme.borderRadius} 0 0`
      : p.theme.borderRadius};
  padding: 0;
  margin: 0;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.textColor};
  z-index: ${p => p.theme.zIndex.globalSelectionHeader};

  /* TimeRageRoot in TimeRangeSelector */
  > div {
    width: 100%;
    align-self: stretch;
  }

  /* StyledItemHeader used to show selected value of TimeRangeSelector */
  > div > div:first-child {
    padding: 0 ${space(2)};
  }

  /* Menu that dropdowns from TimeRangeSelector */
  > div > div:last-child {
    /* Remove awkward 1px width difference on dropdown due to border */
    box-sizing: content-box;
    font-size: 1em;
  }

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-column: auto / span 2;
  }
  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-column: auto / span 3;
  }
`;

const DropdownLabel = styled('span')`
  text-align: left;
  font-weight: 600;
  color: ${p => p.theme.textColor};

  > span:last-child {
    font-weight: 400;
  }
`;
