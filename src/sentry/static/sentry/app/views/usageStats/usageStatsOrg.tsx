import React from 'react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';
import moment from 'moment';

import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Card from 'app/components/card';
import {HeaderTitle} from 'app/components/charts/styles';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelBody} from 'app/components/panels';
import QuestionTooltip from 'app/components/questionTooltip';
import TextOverflow from 'app/components/textOverflow';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {DataCategory, Organization} from 'app/types';

import Chart from './chart';
import {OrganizationUsageStats} from './types';
import {formatUsageWithUnits} from './utils';

type Props = {
  organization: Organization;
  dataCategory: DataCategory;
  dataCategoryName: string;
  onChangeDataCategory: (dataCategory: DataCategory) => void;
} & AsyncComponent['props'];

type State = {
  orgStats: OrganizationUsageStats;
} & AsyncComponent['state'];

class UsageStatsOrganization extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization} = this.props;

    // TODO(org-stats): Allow user to pick date range
    const fourWeeksAgo = moment().subtract(31, 'days').unix();
    const today = moment().unix();

    return [
      [
        'orgStats',
        `/organizations/${organization.slug}/stats_v2/`,
        {
          query: {
            start: fourWeeksAgo,
            end: today,
            interval: '1d',
          },
        },
      ],
    ];
  }

  /**
   * Ignore this hard-coded method. API response is being changed so this will
   * be amended in a few days.
   */
  get formattedOrgStats(): {
    stats: any[];
    total: string;
    accepted: string;
    dropped: string;
    filtered: string;
  } {
    const {dataCategory} = this.state;

    const formatOptions = {
      isAbbreviated: dataCategory !== DataCategory.ATTACHMENTS,
      useUnitScaling: dataCategory === DataCategory.ATTACHMENTS,
    };

    return {
      stats: [],
      total: formatUsageWithUnits(0, dataCategory, formatOptions),
      accepted: formatUsageWithUnits(0, dataCategory, formatOptions),
      dropped: formatUsageWithUnits(0, dataCategory, formatOptions),
      filtered: formatUsageWithUnits(0, dataCategory, formatOptions),
    };
  }

  renderCards() {
    const {dataCategory, dataCategoryName} = this.props;
    const {total, accepted, dropped, filtered} = this.formattedOrgStats;

    const cardData = [
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
        {cardData.map((c, i) => (
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

  renderChart(e?: Error) {
    // TODO(leedongwei): Poke someone for a error-state design
    if (this.state.error || e) {
      return (
        <Panel>
          <PanelBody>
            <p>UsageStatsOrganization has an error: {e?.message}</p>
          </PanelBody>
        </Panel>
      );
    }

    if (this.state.loading || !this.state.orgStats) {
      return (
        <Panel>
          <PanelBody>
            <LoadingIndicator />
          </PanelBody>
        </Panel>
      );
    }

    const {dataCategory} = this.state;
    const {onChangeDataCategory} = this.props;
    const {stats} = this.formattedOrgStats;

    const today = moment().format('YYYY-MM-DD');
    const start = moment().subtract(30, 'days').format('YYYY-MM-DD');

    return (
      <Panel>
        <Chart
          hasTransactions
          hasAttachments={false}
          usagePeriodStart={start}
          usagePeriodEnd={today}
          usagePeriodToday={today}
          statsAttachments={stats}
          statsErrors={stats}
          statsTransactions={stats}
        />

        <ButtonBar active={dataCategory} merged>
          {Object.keys(DataCategory).map(k => {
            return (
              <Button
                key={DataCategory[k]}
                barId={DataCategory[k]}
                onClick={() => onChangeDataCategory(DataCategory[k])}
              >
                {capitalize(DataCategory[k])}
              </Button>
            );
          })}
        </ButtonBar>
      </Panel>
    );
  }

  renderComponent() {
    const {errors} = this.state;

    return (
      <React.Fragment>
        {this.renderCards()}
        {this.renderChart(errors?.['orgStats'])}
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
