import {Component} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Grid} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';

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
import type {ReactRouter3Navigate} from 'sentry/utils/useNavigate';
import {useNavigate} from 'sentry/utils/useNavigate';

import {formatUsageWithUnits, getFormatUsageOptions} from './utils';

const DOCS_URL = 'https://docs.sentry.io/product/accounts/membership/#restricting-access';

type Props = {
  dataCategory: DataCategoryInfo;
  headers: React.ReactNode[];
  location: Location;
  navigate: ReactRouter3Navigate;
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

class UsageTable extends Component<Props> {
  getErrorMessage = (errorMessage: any) => {
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
  };

  loadProject(projectId: number) {
    updateProjects([projectId], this.props.location, this.props.navigate, {
      save: true,
      environments: [], // Clear environments when switching projects
    });
    window.scrollTo({top: 0, left: 0, behavior: 'smooth'});
  }

  renderTableRow(stat: TableStat & {project: Project}) {
    const {dataCategory, showStoredOutcome} = this.props;
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
                this.loadProject(parseInt(stat.project.id, 10));
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

  render() {
    const {isEmpty, isLoading, isError, errors, headers, usageStats} = this.props;

    if (isError) {
      return (
        <Panel>
          <ErrorPanel height="256px">{this.getErrorMessage(errors)}</ErrorPanel>
        </Panel>
      );
    }

    return (
      <StyledSimpleTable
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
        {!isLoading && usageStats.map(s => this.renderTableRow(s))}
      </StyledSimpleTable>
    );
  }
}

/**
 * Wrapper that injects `navigate` and `location` hooks into UsageTable.
 */
function UsageTableWithHooks(props: Omit<Props, 'navigate' | 'location'>) {
  const navigate = useNavigate();
  const location = useLocation();
  return <UsageTable {...props} navigate={navigate} location={location} />;
}

// eslint-disable-next-line @sentry/no-default-exports
export default UsageTableWithHooks;

const StyledSimpleTable = styled(SimpleTable)`
  grid-template-columns: repeat(7, auto);
  @container (min-width: ${p => p.theme.container.xl}) {
    grid-template-columns: 1fr repeat(6, minmax(0, auto));
  }
`;

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
