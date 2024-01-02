import {Component} from 'react';
import {WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import {updateProjects} from 'sentry/actionCreators/pageFilters';
import {Button} from 'sentry/components/button';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import EmptyMessage from 'sentry/components/emptyMessage';
import IdBadge from 'sentry/components/idBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import Panel from 'sentry/components/panels/panel';
import PanelTable, {PanelTableHeader} from 'sentry/components/panels/panelTable';
import {IconGraph, IconSettings, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategoryInfo, Project} from 'sentry/types';
import withSentryRouter from 'sentry/utils/withSentryRouter';

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
} & WithRouterProps<{}, {}>;

export type TableStat = {
  accepted: number;
  dropped: number;
  filtered: number;
  project: Project;
  projectLink: string;
  projectSettingsLink: string;
  total: number;
};

class UsageTable extends Component<Props> {
  getErrorMessage = errorMessage => {
    if (errorMessage.projectStats.responseJSON.detail === 'No projects available') {
      return (
        <EmptyMessage
          icon={<IconWarning color="gray300" legacySize="48px" />}
          title={t(
            "You don't have access to any projects, or your organization has no projects."
          )}
          description={tct('Learn more about [link:Project Access]', {
            link: <ExternalLink href={DOCS_URL} />,
          })}
        />
      );
    }
    return <IconWarning color="gray300" legacySize="48px" />;
  };

  loadProject(projectId: number) {
    updateProjects([projectId], this.props.router, {
      save: true,
      environments: [], // Clear environments when switching projects
    });
    window.scrollTo({top: 0, left: 0, behavior: 'smooth'});
  }

  renderTableRow(stat: TableStat & {project: Project}) {
    const {dataCategory} = this.props;
    const {project, total, accepted, filtered, dropped} = stat;

    return [
      <CellProject key={0}>
        <Link to={stat.projectLink}>
          <StyledIdBadge
            avatarSize={16}
            disableLink
            hideOverflow
            project={project}
            displayName={project.slug}
          />
        </Link>
      </CellProject>,
      <CellStat key={1}>
        {formatUsageWithUnits(
          total,
          dataCategory.plural,
          getFormatUsageOptions(dataCategory.plural)
        )}
      </CellStat>,
      <CellStat key={2}>
        {formatUsageWithUnits(
          accepted,
          dataCategory.plural,
          getFormatUsageOptions(dataCategory.plural)
        )}
      </CellStat>,
      <CellStat key={3}>
        {formatUsageWithUnits(
          filtered,
          dataCategory.plural,
          getFormatUsageOptions(dataCategory.plural)
        )}
      </CellStat>,
      <CellStat key={4}>
        {formatUsageWithUnits(
          dropped,
          dataCategory.plural,
          getFormatUsageOptions(dataCategory.plural)
        )}
      </CellStat>,
      <CellStat key={5}>
        <Button
          title="Go to project level stats"
          data-test-id={project.slug}
          size="xs"
          onClick={() => {
            this.loadProject(parseInt(stat.project.id, 10));
          }}
        >
          <StyledIconGraph type="bar" size="sm" />
          <span>View Stats</span>
        </Button>
        <Link to={stat.projectSettingsLink}>
          <StyledSettingsButton size="xs" title="Go to project settings">
            <SettingsIcon size="sm" />
          </StyledSettingsButton>
        </Link>
      </CellStat>,
    ];
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
      <StyledPanelTable isLoading={isLoading} isEmpty={isEmpty} headers={headers}>
        {usageStats.map(s => this.renderTableRow(s))}
      </StyledPanelTable>
    );
  }
}

export default withSentryRouter(UsageTable);

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: repeat(6, auto);

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 1fr repeat(5, minmax(0, auto));
  }

  ${PanelTableHeader} {
    height: 45px;
  }
`;

export const CellStat = styled('div')`
  display: flex;
  align-items: center;
  font-variant-numeric: tabular-nums;
  justify-content: right;
  padding-top: 9px;
  padding-bottom: 9px;
`;

export const CellProject = styled(CellStat)`
  justify-content: left;
`;

const StyledIdBadge = styled(IdBadge)`
  overflow: hidden;
  white-space: nowrap;
  flex-shrink: 1;
`;

const SettingsIcon = styled(IconSettings)`
  color: ${p => p.theme.gray300};
  align-items: center;
  display: inline-flex;
  justify-content: space-between;
  margin-right: ${space(1.0)};
  margin-left: ${space(1.0)};
  transition: 0.5s opacity ease-out;

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

const StyledIconGraph = styled(IconGraph)`
  color: ${p => p.theme.gray300};
  margin-right: 5px;
  &:hover {
    color: ${p => p.theme.textColor};
    cursor: pointer;
  }
`;

const StyledSettingsButton = styled(Button)`
  padding: 0px;
  margin-left: 7px;
`;
