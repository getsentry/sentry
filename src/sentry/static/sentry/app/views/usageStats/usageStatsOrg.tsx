import React from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import AsyncComponent from 'app/components/asyncComponent';
import Card from 'app/components/card';
import ErrorPanel from 'app/components/charts/errorPanel';
import OptionSelector from 'app/components/charts/optionSelector';
import {
  ChartControls,
  HeaderTitle,
  InlineContainer,
  SectionValue,
} from 'app/components/charts/styles';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelBody} from 'app/components/panels';
import QuestionTooltip from 'app/components/questionTooltip';
import TextOverflow from 'app/components/textOverflow';
import {IconCalendar, IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {DataCategory, Organization} from 'app/types';

import {OrganizationUsageStats} from './types';
import UsageChart, {
  CHART_OPTIONS_DATA_TRANSFORM,
  CHART_OPTIONS_DATACATEGORY,
  ChartDataTransform,
  ChartStats,
} from './usageChart';
import {formatUsageWithUnits} from './utils';

type Props = {
  organization: Organization;
  dataCategory: DataCategory;
  dataCategoryName: string;
  dateStart: moment.Moment;
  dateEnd: moment.Moment;
  onChangeDataCategory: (dataCategory: DataCategory) => void;
  onChangeDateRange: (dateStart: moment.Moment, dateEnd: moment.Moment) => void;
} & AsyncComponent['props'];

type State = {
  orgStats: OrganizationUsageStats;
  chartDataTransform: ChartDataTransform;
} & AsyncComponent['state'];

class UsageStatsOrganization extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      chartDataTransform: ChartDataTransform.CUMULATIVE,
    };
  }

  /**
   * Ignore this hard-coded method.
   * This will be updated in a separate PR.
   */
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization} = this.props;

    return [
      [
        'orgStats',
        `/organizations/${organization.slug}/stats_v2/`,
        {
          query: {
            interval: '1d',
          },
        },
      ],
    ];
  }

  get chartMetadata() {
    const {orgStats} = this.state;

    return {
      ...this.mapStatsToChart(orgStats),
    };
  }

  handleSelectDataTransform(value: ChartDataTransform) {
    this.setState({chartDataTransform: value});
  }

  /**
   * Ignore this hard-coded method.
   * This will be updated in a separate PR.
   */
  mapStatsToChart(
    _orgStats: any
  ): {
    chartData: ChartStats;
    cardData: {
      total: string;
      accepted: string;
      dropped: string;
      filtered: string;
    };
  } {
    const {dataCategory} = this.state;

    let sumTotal = 0;
    let sumAccepted = 0;
    let sumDropped = 0;
    let sumFiltered = 0;

    const chartData: ChartStats = {
      accepted: [],
      dropped: [],
      projected: [],
    };

    // Please ignore this stub
    for (let i = 1; i <= 31; i++) {
      const date = `Mar ${i}`;

      chartData.accepted.push({value: [date, 2000]} as any); // TODO(ts)
      chartData.dropped.push({value: [date, 1000]} as any); // TODO(ts)

      sumTotal += 5000;
      sumAccepted += 2000;
      sumDropped += 1000;
      sumFiltered += 2000;
    }

    const formatOptions = {
      isAbbreviated: dataCategory !== DataCategory.ATTACHMENT,
      useUnitScaling: dataCategory === DataCategory.ATTACHMENT,
    };

    return {
      cardData: {
        total: formatUsageWithUnits(sumTotal, dataCategory, formatOptions),
        accepted: formatUsageWithUnits(sumAccepted, dataCategory, formatOptions),
        dropped: formatUsageWithUnits(sumDropped, dataCategory, formatOptions),
        filtered: formatUsageWithUnits(sumFiltered, dataCategory, formatOptions),
      },
      chartData,
    };
  }

  renderCards() {
    const {dataCategory, dataCategoryName} = this.props;
    const {total, accepted, dropped, filtered} = this.chartMetadata.cardData;

    const cardMetadata = [
      {
        title: tct('Total [dataCategory]', {dataCategory: dataCategoryName}),
        value: total,
      },
      {
        title: t('Accepted'),
        value: accepted,
      },
      {
        title: t('Filtered'),
        description: tct(
          'Filtered [dataCategory] were blocked due to your inbound data filter rules',
          {dataCategory}
        ),
        value: filtered,
      },
      // TODO(org-stats): Need a better description for dropped data
      {
        title: t('Dropped'),
        description: tct(
          'Dropped [dataCategory] were discarded due to rate-limits, quota limits, or spike protection',
          {dataCategory}
        ),
        value: dropped,
      },
    ];

    return (
      <CardWrapper>
        {cardMetadata.map((c, i) => (
          <StyledCard key={i}>
            <HeaderTitle>
              <TextOverflow>{c.title}</TextOverflow>
              {c.description && (
                <QuestionTooltip size="sm" position="top" title={c.description} />
              )}
            </HeaderTitle>
            <CardContent>
              <TextOverflow>{c.value}</TextOverflow>
            </CardContent>
          </StyledCard>
        ))}
      </CardWrapper>
    );
  }

  renderChart() {
    const {dateStart, dateEnd, dataCategory} = this.props;
    const {chartDataTransform, error, loading, orgStats} = this.state;

    if (loading) {
      return (
        <Panel>
          <PanelBody>
            <LoadingIndicator />
          </PanelBody>
        </Panel>
      );
    }

    if (error || !orgStats) {
      return (
        <Panel>
          <PanelBody>
            <ErrorPanel height="256px">
              <IconWarning color="gray300" size="lg" />
            </ErrorPanel>
          </PanelBody>
        </Panel>
      );
    }

    const {chartData} = this.chartMetadata;
    const usageDateStart = dateStart.format('YYYY-MM-DD');
    const usageDateEnd = dateEnd.format('YYYY-MM-DD');

    return (
      <UsageChart
        footer={this.renderChartFooter()}
        dataCategory={dataCategory}
        dataTransform={chartDataTransform}
        usageDateStart={usageDateStart}
        usageDateEnd={usageDateEnd}
        usageStats={chartData}
      />
    );
  }

  renderChartFooter = () => {
    const {dataCategory, onChangeDataCategory} = this.props;
    const {chartDataTransform} = this.state;

    return (
      <ChartControls>
        <InlineContainer>
          <SectionValue>
            <IconCalendar />
          </SectionValue>
          <SectionValue>
            {/*
            TODO(org-stats): Add calendar dropdown for user to select date range

            {moment(usagePeriodStart).format('ll')}
            {' — '}
            {moment(usagePeriodEnd).format('ll')}
            */}
          </SectionValue>
        </InlineContainer>
        <InlineContainer>
          <OptionSelector
            title={t('Display')}
            menuWidth="135px"
            selected={dataCategory}
            options={CHART_OPTIONS_DATACATEGORY}
            onChange={(val: string) => onChangeDataCategory(val as DataCategory)}
          />
          <OptionSelector
            title={t('Type')}
            selected={chartDataTransform}
            options={CHART_OPTIONS_DATA_TRANSFORM}
            onChange={(val: string) =>
              this.handleSelectDataTransform(val as ChartDataTransform)
            }
          />
        </InlineContainer>
      </ChartControls>
    );
  };

  renderComponent() {
    return (
      <React.Fragment>
        {this.renderCards()}
        {this.renderChart()}
      </React.Fragment>
    );
  }
}

export default UsageStatsOrganization;

const CardWrapper = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  grid-auto-rows: 1fr;
  grid-gap: ${space(2)};
  margin-bottom: ${space(3)};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-auto-flow: row;
  }
`;

const StyledCard = styled(Card)`
  align-items: flex-start;
  min-height: 95px;
  padding: ${space(2)} ${space(3)};
  color: ${p => p.theme.textColor};
`;

const CardContent = styled('div')`
  margin-top: ${space(1)};
  font-size: 32px;
`;
