import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';

import AsyncComponent from 'app/components/asyncComponent';
import {DateTimeObject} from 'app/components/charts/utils';
import IdBadge from 'app/components/idBadge';
import Link from 'app/components/links/link';
import PanelTable from 'app/components/panels/panelTable';
import {IconChevron, IconList} from 'app/icons';
import {t, tct} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization, Project, SavedQueryVersions} from 'app/types';
import DiscoverQuery, {TableData, TableDataRow} from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import type {Color} from 'app/utils/theme';

import {transactionSummaryRouteWithQuery} from '../../performance/transactionSummary/utils';

type TeamMiseryProps = {
  organization: Organization;
  location: Location;
  projects: Project[];
  periodTableData: TableData | null;
  weekTableData: TableData | null;
  isLoading: boolean;
  period?: string;
};

/** The number of elements to display before collapsing */
const COLLAPSE_COUNT = 8;

function TeamMisery({
  organization,
  location,
  projects,
  periodTableData,
  weekTableData,
  isLoading,
  period,
}: TeamMiseryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const miseryRenderer =
    periodTableData?.meta && getFieldRenderer('user_misery', periodTableData.meta);

  function expandResults() {
    setIsExpanded(true);
  }

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

  const worseItems = sortedTableData.filter(x => Math.round(x.trend) < 0);
  const betterItems = sortedTableData.filter(x => Math.round(x.trend) > 0);
  const zeroItems = sortedTableData.filter(x => Math.round(x.trend) === 0);
  const groupedData = [...worseItems, ...betterItems, ...zeroItems];

  return (
    <Fragment>
      <StyledPanelTable
        isEmpty={projects.length === 0 || periodTableData?.data.length === 0}
        headers={[
          t('Key transaction'),
          t('Project'),
          tct('Last [period]', {period}),
          t('This Week'),
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
              <ProjectBadgeContainer>
                {project && <ProjectBadge avatarSize={18} project={project} />}
              </ProjectBadgeContainer>
              <div>{periodMisery}</div>
              <div>{weekMisery ?? '\u2014'}</div>
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
      {groupedData.length >= COLLAPSE_COUNT && !isExpanded && !isLoading && (
        <ShowMore onClick={expandResults}>
          <ShowMoreText>
            <StyledIconList color="gray300" />
            {tct('Show [count] More', {count: groupedData.length - 1 - COLLAPSE_COUNT})}
          </ShowMoreText>

          <IconChevron color="gray300" direction="down" />
        </ShowMore>
      )}
    </Fragment>
  );
}

type Props = AsyncComponent['props'] & {
  organization: Organization;
  projects: Project[];
  location: Location;
  period?: string;
  start?: string;
  end?: string;
} & DateTimeObject;

function TeamMiseryWrapper({
  organization,
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
    projects: projects.map(project => Number(project.id)),
    version: 2 as SavedQueryVersions,
    orderby: '-tpm',
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
    range: period,
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
      {({isLoading, tableData: periodTableData}) => (
        <DiscoverQuery
          eventView={weekEventView}
          orgSlug={organization.slug}
          location={location}
        >
          {({isLoading: isWeekLoading, tableData: weekTableData}) => (
            <TeamMisery
              isLoading={isLoading || isWeekLoading}
              organization={organization}
              location={location}
              projects={projects}
              period={period}
              periodTableData={periodTableData}
              weekTableData={weekTableData}
            />
          )}
        </DiscoverQuery>
      )}
    </DiscoverQuery>
  );
}

export default TeamMiseryWrapper;

const StyledPanelTable = styled(PanelTable)<{isEmpty: boolean}>`
  grid-template-columns: 1fr 0.5fr 112px 112px 0.25fr;
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

const ProjectBadgeContainer = styled('div')`
  display: flex;
`;

const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
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

const ShowMore = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(1)} ${space(2)};
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
  cursor: pointer;
  border-top: 1px solid ${p => p.theme.border};
`;

const StyledIconList = styled(IconList)`
  margin-right: ${space(1)};
`;

const ShowMoreText = styled('div')`
  display: flex;
  align-items: center;
  flex-grow: 1;
`;
