import React from 'react';
import styled from '@emotion/styled';

import IdBadge from 'app/components/idBadge';
import Link from 'app/components/links/link';
import {SettingsIconLink} from 'app/components/organizations/headerItem';
import PanelTable from 'app/components/panels/panelTable';
import TextOverflow from 'app/components/textOverflow';
import {IconSettings} from 'app/icons';
import {DataCategory, Project} from 'app/types';
import theme from 'app/utils/theme';

import {formatUsageWithUnits} from '../utils';

type Props = {
  isLoading?: boolean;
  isEmpty?: boolean;
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

  renderTableRow(stat: TableStat & {project: Project}) {
    const {dataCategory} = this.props;
    const {project, total, accepted, filtered, dropped} = stat;

    return [
      <CellProject key={0}>
        <TextOverflow>
          <StyledIdBadge
            project={project}
            avatarSize={16}
            hideOverflow
            displayName={<Link to={stat.projectLink}>{project.slug}</Link>}
          />
        </TextOverflow>
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
    const {isEmpty, isLoading, headers, usageStats} = this.props;

    return (
      <StyledPanelTable isLoading={isLoading} isEmpty={isEmpty} headers={headers}>
        {usageStats.map(s => this.renderTableRow(s))}
      </StyledPanelTable>
    );
  }
}

export default UsageTable;

export const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: auto 100px 100px 100px 100px;
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
