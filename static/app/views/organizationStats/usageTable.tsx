import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Grid} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import type {TableColumnConfig} from '@sentry/scraps/table';

import {ErrorPanel} from 'sentry/components/charts/errorPanel';
import {EmptyMessage} from 'sentry/components/emptyMessage';
import {IdBadge} from 'sentry/components/idBadge';
import {updateProjects} from 'sentry/components/pageFilters/actions';
import {Panel} from 'sentry/components/panels/panel';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconGraph, IconSettings, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {DataCategoryInfo} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

import {formatUsageWithUnits, getFormatUsageOptions} from './utils';

const DOCS_URL = 'https://docs.sentry.io/product/accounts/membership/#restricting-access';

type Props = {
  dataCategory: DataCategoryInfo;
  headers: React.ReactNode[];
  usageStats: TableStat[];
  errors?: Record<string, Error>;
  isEmpty?: boolean;
  isError?: boolean;
  isLoading?: boolean;
  showStoredOutcome?: boolean;
};

export type TableStat = {
  accepted: number;
  accepted_stored: number;
  filtered: number;
  invalid: number;
  project: Project;
  projectLink: string;
  projectSettingsLink: string;
  rate_limited: number;
  total: number;
};

function getErrorMessage(errorMessage: any) {
  if (errorMessage.projectStats.responseJSON.detail === 'No projects available') {
    return (
      <EmptyMessage
        icon={<IconWarning />}
        title={t(
          "You don't have access to any projects, or your organization has no projects."
        )}
      >
        {tct('Learn more about [link:Project Access]', {
          link: <ExternalLink href={DOCS_URL} />,
        })}
      </EmptyMessage>
    );
  }
  return <IconWarning variant="muted" legacySize="48px" />;
}

function UsageTable({
  dataCategory,
  headers,
  usageStats,
  errors,
  isEmpty,
  isError,
  isLoading,
  showStoredOutcome,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  function loadProject(projectId: number) {
    updateProjects([projectId], location, navigate, {
      save: true,
      environments: [], // Clear environments when switching projects
    });
    window.scrollTo({top: 0, left: 0, behavior: 'smooth'});
  }

  function renderTableRow(stat: TableStat & {project: Project}) {
    const {project, total, accepted, accepted_stored, filtered, invalid, rate_limited} =
      stat;

    return (
      <SimpleTable.Row key={project.id}>
        <RowCellProject>
          <Link to={stat.projectLink}>
            <StyledIdBadge
              avatarSize={16}
              disableLink
              hideOverflow
              project={project}
              displayName={project.slug}
            />
          </Link>
        </RowCellProject>
        <RowCellStat>
          {formatUsageWithUnits(
            total,
            dataCategory.plural,
            getFormatUsageOptions(dataCategory.plural)
          )}
        </RowCellStat>
        <RowCellStat>
          {formatUsageWithUnits(
            accepted,
            dataCategory.plural,
            getFormatUsageOptions(dataCategory.plural)
          )}
          {showStoredOutcome && (
            <SubText>
              {`(${formatUsageWithUnits(
                accepted_stored,
                dataCategory.plural,
                getFormatUsageOptions(dataCategory.plural)
              )})`}
            </SubText>
          )}
        </RowCellStat>
        <RowCellStat>
          {formatUsageWithUnits(
            filtered,
            dataCategory.plural,
            getFormatUsageOptions(dataCategory.plural)
          )}
        </RowCellStat>
        <RowCellStat>
          {formatUsageWithUnits(
            rate_limited,
            dataCategory.plural,
            getFormatUsageOptions(dataCategory.plural)
          )}
        </RowCellStat>
        <RowCellStat>
          {formatUsageWithUnits(
            invalid,
            dataCategory.plural,
            getFormatUsageOptions(dataCategory.plural)
          )}
        </RowCellStat>
        <RowCellStat>
          <Grid flow="column" align="center" gap="md">
            <Button
              icon={<IconGraph type="bar" />}
              data-test-id={project.slug}
              size="xs"
              onClick={() => {
                loadProject(parseInt(stat.project.id, 10));
              }}
            >
              {t('View Project Stats')}
            </Button>
            <LinkButton icon={<IconSettings />} size="xs" to={stat.projectSettingsLink}>
              {t('Project Settings')}
            </LinkButton>
          </Grid>
        </RowCellStat>
      </SimpleTable.Row>
    );
  }

  if (isError) {
    return (
      <Panel>
        <ErrorPanel height="256px">{getErrorMessage(errors)}</ErrorPanel>
      </Panel>
    );
  }

  return (
    <SimpleTable
      columns={USAGE_COLUMNS}
      header={
        <SimpleTable.HeaderRow>
          {headers.map((header, i) => (
            <SimpleTable.HeaderCell key={i}>{header}</SimpleTable.HeaderCell>
          ))}
        </SimpleTable.HeaderRow>
      }
    >
      {isLoading && <SimpleTable.Loading />}
      {!isLoading && isEmpty && (
        <SimpleTable.Empty>{t('No data available')}</SimpleTable.Empty>
      )}
      {!isLoading && usageStats.map(s => renderTableRow(s))}
    </SimpleTable>
  );
}

// eslint-disable-next-line @sentry/no-default-exports
export default UsageTable;

const STAT_COLUMN_WIDTH = {zero: 'auto', xl: 'minmax(0, auto)'};

const USAGE_COLUMNS: TableColumnConfig[] = [
  {key: 'project', width: {zero: 'auto', xl: '1fr'}},
  {key: 'total', width: STAT_COLUMN_WIDTH},
  {key: 'accepted', width: STAT_COLUMN_WIDTH},
  {key: 'filtered', width: STAT_COLUMN_WIDTH},
  {key: 'rateLimited', width: STAT_COLUMN_WIDTH},
  {key: 'invalid', width: STAT_COLUMN_WIDTH},
  {key: 'actions', width: STAT_COLUMN_WIDTH},
];

const cellStatStyle = css`
  display: flex;
  align-items: center;
  font-variant-numeric: tabular-nums;
  justify-content: right;
`;

/**
 * Header cells; `usageStatsProjects` builds the `headers` array out of these, so
 * they stay plain elements rather than table cells.
 */
export const CellStat = styled('div')`
  ${cellStatStyle}
`;

export const CellProject = styled(CellStat)`
  justify-content: left;
`;

const RowCellStat = styled(SimpleTable.RowCell)`
  ${cellStatStyle}
`;

const RowCellProject = styled(RowCellStat)`
  justify-content: left;
`;

const StyledIdBadge = styled(IdBadge)`
  overflow: hidden;
  white-space: nowrap;
  flex-shrink: 1;
`;

const SubText = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  margin-left: ${p => p.theme.space.xs};
`;
