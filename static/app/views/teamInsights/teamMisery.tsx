import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import AsyncComponent from 'app/components/asyncComponent';
import {DateTimeObject} from 'app/components/charts/utils';
import IdBadge from 'app/components/idBadge';
import Link from 'app/components/links/link';
import PanelTable from 'app/components/panels/panelTable';
import {t, tct} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization, Project, SavedQueryVersions} from 'app/types';
import DiscoverQuery, {TableData} from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import type {Color} from 'app/utils/theme';

import {transactionSummaryRouteWithQuery} from '../performance/transactionSummary/utils';

type TeamMiseryProps = {
  organization: Organization;
  location: Location;
  projects: Project[];
  periodTableData: TableData | null;
  comparisonTableData: TableData | null;
  isLoading: boolean;
  comparisonPeriod: string;
  period?: string;
};

function TeamMisery({
  organization,
  location,
  projects,
  periodTableData,
  comparisonTableData,
  isLoading,
  comparisonPeriod,
  period,
}: TeamMiseryProps) {
  const miseryRenderer =
    periodTableData?.meta && getFieldRenderer('user_misery', periodTableData.meta);

  function renderTrend(periodScore: number, weekScore?: number) {
    if (weekScore === undefined) {
      return '\u2014';
    }

    const trend = (periodScore - weekScore) * 100;
    const val = Math.round(Math.abs(trend));

    return (
      <SubText color={trend >= 0 ? 'green300' : 'red300'}>
        {`${val}\u0025 `}
        {trend >= 0 ? t('better') : t('worse')}
      </SubText>
    );
  }

  return (
    <StyledPanelTable
      headers={[
        t('Key transaction'),
        t('Project'),
        tct('Last [period]', {period}),
        comparisonPeriod === '1d' ? t('Last 24h') : t('Last Week'),
        <RightAligned key="diff">{t('Difference')}</RightAligned>,
      ]}
      isLoading={isLoading}
    >
      {periodTableData?.data.map((dataRow, idx) => {
        const project = projects.find(({slug}) => dataRow.project === slug);

        const comparisonRow = comparisonTableData?.data.find(
          row =>
            row.project === dataRow.project && row.transaction === dataRow.transaction
        );
        const periodMisery = miseryRenderer?.(dataRow, {organization, location});
        const comparisonMisery =
          comparisonRow && miseryRenderer?.(comparisonRow, {organization, location});

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
            <div>{comparisonMisery ?? '\u2014'}</div>
            <ScoreWrapper>
              {renderTrend(
                dataRow.user_misery as number,
                comparisonRow?.user_misery as undefined | number
              )}
            </ScoreWrapper>
          </Fragment>
        );
      })}
    </StyledPanelTable>
  );
}

type Props = AsyncComponent['props'] & {
  organization: Organization;
  projects: Project[];
  location: Location;
  comparisonPeriod: string;
  period?: string;
  start?: string;
  end?: string;
} & DateTimeObject;

function TeamMiseryWrapper({
  organization,
  projects,
  location,
  comparisonPeriod,
  period,
  start,
  end,
}: Props) {
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

  const comparisonEventView = EventView.fromSavedQuery({
    ...commonEventView,
    name: 'comparisonMisery',
    range: comparisonPeriod,
  });

  return (
    <DiscoverQuery
      eventView={periodEventView}
      orgSlug={organization.slug}
      location={location}
    >
      {({isLoading, tableData: periodTableData}) => (
        <DiscoverQuery
          eventView={comparisonEventView}
          orgSlug={organization.slug}
          location={location}
        >
          {({isLoading: isComparisonLoading, tableData: comparisonTableData}) => (
            <TeamMisery
              isLoading={isLoading || isComparisonLoading}
              organization={organization}
              location={location}
              projects={projects}
              period={period}
              comparisonPeriod={comparisonPeriod}
              periodTableData={periodTableData}
              comparisonTableData={comparisonTableData}
            />
          )}
        </DiscoverQuery>
      )}
    </DiscoverQuery>
  );
}

export default TeamMiseryWrapper;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr 0.5fr 112px 112px 0.25fr;
  font-size: ${p => p.theme.fontSizeMedium};
  white-space: nowrap;
  margin-bottom: 0;
  border: 0;
  box-shadow: none;

  & > div {
    padding: ${space(1)} ${space(2)};
  }
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

const SubText = styled('div')<{color: Color}>`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme[p.color]};
`;
