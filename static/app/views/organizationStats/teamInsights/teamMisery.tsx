import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';

import AsyncComponent from 'sentry/components/asyncComponent';
import Button from 'sentry/components/button';
import {DateTimeObject} from 'sentry/components/charts/utils';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import PanelTable from 'sentry/components/panels/panelTable';
import {IconStar} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Organization, Project, SavedQueryVersions} from 'sentry/types';
import DiscoverQuery, {
  TableData,
  TableDataRow,
} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Color} from 'sentry/utils/theme';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

import CollapsePanel, {COLLAPSE_COUNT} from './collapsePanel';
import {ProjectBadge, ProjectBadgeContainer} from './styles';
import {groupByTrend} from './utils';

type TeamMiseryProps = {
  isLoading: boolean;
  location: Location;
  organization: Organization;
  periodTableData: TableData | null;
  projects: Project[];
  weekTableData: TableData | null;
  error?: Error | null;
  period?: string | null;
};

function TeamMisery({
  organization,
  location,
  projects,
  periodTableData,
  weekTableData,
  isLoading,
  period,
  error,
}: TeamMiseryProps) {
  const miseryRenderer =
    periodTableData?.meta && getFieldRenderer('user_misery', periodTableData.meta);

  // Calculate trend, so we can sort based on it
  const sortedTableData = (periodTableData?.data ?? [])
    .map(dataRow => {
      const weekRow = weekTableData?.data.find(
        row => row.project === dataRow.project && row.transaction === dataRow.transaction
      );

      const trend = weekRow
        ? ((dataRow.user_misery as number) - (weekRow.user_misery as number)) * 100
        : null;

      return {
        ...dataRow,
        trend,
      } as TableDataRow & {trend: number};
    })
    .filter(x => x.trend !== null)
    .sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend));

  const groupedData = groupByTrend(sortedTableData);

  if (error) {
    return <LoadingError />;
  }

  return (
    <CollapsePanel items={groupedData.length}>
      {({isExpanded, showMoreButton}) => (
        <Fragment>
          <StyledPanelTable
            isEmpty={projects.length === 0 || periodTableData?.data.length === 0}
            emptyMessage={t('No key transactions starred by this team')}
            emptyAction={
              <Button
                size="small"
                external
                href="https://docs.sentry.io/product/performance/transaction-summary/#starring-key-transactions"
              >
                {t('Learn More')}
              </Button>
            }
            headers={[
              <FlexCenter key="transaction">
                <StyledIconStar isSolid color="yellow300" /> {t('Key transaction')}
              </FlexCenter>,
              t('Project'),
              tct('Last [period]', {period}),
              t('Last 7 Days'),
              <RightAligned key="change">{t('Change')}</RightAligned>,
            ]}
            isLoading={isLoading}
          >
            {groupedData.map((dataRow, idx) => {
              const project = projects.find(({slug}) => dataRow.project === slug);
              const {trend, project: projectId, transaction} = dataRow;

              const weekRow = weekTableData?.data.find(
                row => row.project === projectId && row.transaction === transaction
              );
              if (!weekRow || trend === null) {
                return null;
              }

              const periodMisery = miseryRenderer?.(dataRow, {organization, location});
              const weekMisery =
                weekRow && miseryRenderer?.(weekRow, {organization, location});
              const trendValue = Math.round(Math.abs(trend));

              if (idx >= COLLAPSE_COUNT && !isExpanded) {
                return null;
              }

              return (
                <Fragment key={idx}>
                  <KeyTransactionTitleWrapper>
                    <div>
                      <StyledIconStar isSolid color="yellow300" />
                    </div>
                    <TransactionWrapper>
                      <Link
                        to={transactionSummaryRouteWithQuery({
                          orgSlug: organization.slug,
                          transaction: dataRow.transaction as string,
                          projectID: project?.id,
                          query: {query: 'transaction.duration:<15m'},
                        })}
                      >
                        {dataRow.transaction}
                      </Link>
                    </TransactionWrapper>
                  </KeyTransactionTitleWrapper>
                  <FlexCenter>
                    <ProjectBadgeContainer>
                      {project && <ProjectBadge avatarSize={18} project={project} />}
                    </ProjectBadgeContainer>
                  </FlexCenter>
                  <FlexCenter>{periodMisery}</FlexCenter>
                  <FlexCenter>{weekMisery ?? '\u2014'}</FlexCenter>
                  <ScoreWrapper>
                    {trendValue === 0 ? (
                      <SubText>
                        {`0\u0025 `}
                        {t('change')}
                      </SubText>
                    ) : (
                      <TrendText color={trend >= 0 ? 'green300' : 'red300'}>
                        {`${trendValue}\u0025 `}
                        {trend >= 0 ? t('better') : t('worse')}
                      </TrendText>
                    )}
                  </ScoreWrapper>
                </Fragment>
              );
            })}
          </StyledPanelTable>
          {!isLoading && showMoreButton}
        </Fragment>
      )}
    </CollapsePanel>
  );
}

type Props = AsyncComponent['props'] & {
  location: Location;
  organization: Organization;
  projects: Project[];
  teamId: string;
  end?: string;
  period?: string | null;
  start?: string;
} & DateTimeObject;

function TeamMiseryWrapper({
  organization,
  teamId,
  projects,
  location,
  period,
  start,
  end,
}: Props) {
  if (projects.length === 0) {
    return (
      <TeamMisery
        isLoading={false}
        organization={organization}
        location={location}
        projects={[]}
        period={period}
        periodTableData={{data: []}}
        weekTableData={{data: []}}
      />
    );
  }

  const commonEventView = {
    id: undefined,
    query: 'transaction.duration:<15m team_key_transaction:true',
    projects: [],
    version: 2 as SavedQueryVersions,
    orderby: '-tpm',
    teams: [Number(teamId)],
    fields: [
      'transaction',
      'project',
      'tpm()',
      'count_unique(user)',
      'count_miserable(user)',
      'user_misery()',
    ],
  };
  const periodEventView = EventView.fromSavedQuery({
    ...commonEventView,
    name: 'periodMisery',
    range: period ?? undefined,
    start,
    end,
  });

  const weekEventView = EventView.fromSavedQuery({
    ...commonEventView,
    name: 'weekMisery',
    range: '7d',
  });

  return (
    <DiscoverQuery
      eventView={periodEventView}
      orgSlug={organization.slug}
      location={location}
    >
      {({isLoading, tableData: periodTableData, error}) => (
        <DiscoverQuery
          eventView={weekEventView}
          orgSlug={organization.slug}
          location={location}
        >
          {({isLoading: isWeekLoading, tableData: weekTableData, error: weekError}) => (
            <TeamMisery
              isLoading={isLoading || isWeekLoading}
              organization={organization}
              location={location}
              projects={projects}
              period={period}
              periodTableData={periodTableData}
              weekTableData={weekTableData}
              error={error ?? weekError}
            />
          )}
        </DiscoverQuery>
      )}
    </DiscoverQuery>
  );
}

export default TeamMiseryWrapper;

const StyledPanelTable = styled(PanelTable)<{isEmpty: boolean}>`
  grid-template-columns: 1.25fr 0.5fr 112px 112px 0.25fr;
  font-size: ${p => p.theme.fontSizeMedium};
  white-space: nowrap;
  margin-bottom: 0;
  border: 0;
  box-shadow: unset;

  & > div {
    padding: ${space(1)} ${space(2)};
  }

  ${p =>
    p.isEmpty &&
    css`
      & > div:last-child {
        padding: 48px ${space(2)};
      }
    `}
`;

const FlexCenter = styled('div')`
  display: flex;
  align-items: center;
`;

const KeyTransactionTitleWrapper = styled('div')`
  ${overflowEllipsis};
  display: flex;
  align-items: center;
`;

const StyledIconStar = styled(IconStar)`
  display: block;
  margin-right: ${space(1)};
  margin-bottom: ${space(0.5)};
`;

const TransactionWrapper = styled('div')`
  ${overflowEllipsis};
`;

const RightAligned = styled('span')`
  text-align: right;
`;

const ScoreWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  text-align: right;
`;

const SubText = styled('div')`
  color: ${p => p.theme.subText};
`;

const TrendText = styled('div')<{color: Color}>`
  color: ${p => p.theme[p.color]};
`;
