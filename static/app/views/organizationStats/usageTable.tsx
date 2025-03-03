import {Component} from 'react';
import styled from '@emotion/styled';

import {updateProjects} from 'sentry/actionCreators/pageFilters';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import EmptyMessage from 'sentry/components/emptyMessage';
import IdBadge from 'sentry/components/idBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import Panel from 'sentry/components/panels/panel';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {IconGraph, IconSettings, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DataCategoryInfo} from 'sentry/types/core';
import type {WithRouterProps} from 'sentry/types/legacyReactRouter';
import type {Project} from 'sentry/types/project';
// eslint-disable-next-line no-restricted-imports
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
  showStoredOutcome?: boolean;
} & WithRouterProps;

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
    const {dataCategory, showStoredOutcome} = this.props;
    const {project, total, accepted, accepted_stored, filtered, invalid, rate_limited} =
      stat;

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
        {showStoredOutcome && (
          <SubText>
            {`(${formatUsageWithUnits(
              accepted_stored,
              dataCategory.plural,
              getFormatUsageOptions(dataCategory.plural)
            )})`}
          </SubText>
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
          rate_limited,
          dataCategory.plural,
          getFormatUsageOptions(dataCategory.plural)
        )}
      </CellStat>,
      <CellStat key={5}>
        {formatUsageWithUnits(
          invalid,
          dataCategory.plural,
          getFormatUsageOptions(dataCategory.plural)
        )}
      </CellStat>,
      <CellStat key={6}>
        <ButtonBar gap={1}>
          <Button
            icon={<IconGraph type="bar" />}
            title="Go to project level stats"
            data-test-id={project.slug}
            size="xs"
            onClick={() => {
              this.loadProject(parseInt(stat.project.id, 10));
            }}
          >
            {t('View Stats')}
          </Button>
          <LinkButton
            icon={<IconSettings />}
            size="xs"
            aria-label={t('Project Settings')}
            title={t('Go to project settings')}
            to={stat.projectSettingsLink}
          />
        </ButtonBar>
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
  grid-template-columns: repeat(7, auto);
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 1fr repeat(6, minmax(0, auto));
  }
`;

export const CellStat = styled('div')`
  display: flex;
  align-items: center;
  font-variant-numeric: tabular-nums;
  justify-content: right;
`;

export const CellProject = styled(CellStat)`
  justify-content: left;
`;

const StyledIdBadge = styled(IdBadge)`
  overflow: hidden;
  white-space: nowrap;
  flex-shrink: 1;
`;

const SubText = styled('span')`
  color: ${p => p.theme.subText};
  margin-left: ${space(0.5)};
`;
