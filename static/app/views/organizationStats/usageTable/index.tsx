import * as React from 'react';
import styled from '@emotion/styled';

import ErrorPanel from 'app/components/charts/errorPanel';
import IdBadge from 'app/components/idBadge';
import ExternalLink from 'app/components/links/externalLink';
import Link from 'app/components/links/link';
import {SettingsIconLink} from 'app/components/organizations/headerItem';
import {Panel} from 'app/components/panels';
import PanelTable from 'app/components/panels/panelTable';
import {IconSettings, IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import {DataCategory, Project} from 'app/types';
import theme from 'app/utils/theme';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

import {formatUsageWithUnits} from '../utils';

const DOCS_URL = 'https://docs.sentry.io/product/accounts/membership/#restricting-access';

type Props = {
  isLoading?: boolean;
  isEmpty?: boolean;
  isError?: boolean;
  errors?: Record<string, Error>;

  headers: React.ReactNode[];

  dataCategory: DataCategory;
  usageStats: TableStat[];
};

export type TableStat = {
  project: Project;
  projectLink: string;
  projectSettingsLink: string;
  total: number;
  accepted: number;
  filtered: number;
  dropped: number;
};

class UsageTable extends React.Component<Props> {
  get formatUsageOptions() {
    const {dataCategory} = this.props;

    return {
      isAbbreviated: dataCategory !== DataCategory.ATTACHMENTS,
      useUnitScaling: dataCategory === DataCategory.ATTACHMENTS,
    };
  }

  getErrorMessage = errorMessage => {
    if (errorMessage.projectStats.responseJSON.detail === 'No projects available') {
      return (
        <EmptyMessage
          icon={<IconWarning color="gray300" size="48" />}
          title={t(
            "You don't have access to any projects, or your organization has no projects."
          )}
          description={tct('Learn more about [link:Project Access]', {
            link: <ExternalLink href={DOCS_URL} />,
          })}
        />
      );
    }
    return <IconWarning color="gray300" size="48" />;
  };

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
        <SettingsIconLink to={stat.projectSettingsLink}>
          <IconSettings size={theme.iconSizes.sm} />
        </SettingsIconLink>
      </CellProject>,
      <CellStat key={1}>
        {formatUsageWithUnits(total, dataCategory, this.formatUsageOptions)}
      </CellStat>,
      <CellStat key={2}>
        {formatUsageWithUnits(accepted, dataCategory, this.formatUsageOptions)}
      </CellStat>,
      <CellStat key={3}>
        {formatUsageWithUnits(filtered, dataCategory, this.formatUsageOptions)}
      </CellStat>,
      <CellStat key={4}>
        {formatUsageWithUnits(dropped, dataCategory, this.formatUsageOptions)}
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

export default UsageTable;

export const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: repeat(5, auto);

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: auto repeat(4, 100px);
  }
`;
export const CellStat = styled('div')`
  flex-shrink: 1;
  text-align: right;
`;
export const CellProject = styled(CellStat)`
  display: flex;
  align-items: center;
  text-align: left;
`;
export const CellSetting = styled(CellStat)`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
`;

const StyledIdBadge = styled(IdBadge)`
  overflow: hidden;
  white-space: nowrap;
  flex-shrink: 1;
`;
