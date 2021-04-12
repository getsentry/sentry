import React from 'react';
import styled from '@emotion/styled';

import IdBadge from 'app/components/idBadge';
import Link from 'app/components/links/link';
import PanelTable from 'app/components/panels/panelTable';
import {DataCategory, Project} from 'app/types';

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

    const projectBadge = (
      <StyledIdBadge
        project={project}
        avatarSize={16}
        hideOverflow
        displayName={<Link to={stat.projectLink}>{project.slug}</Link>}
      />
    );

    return [
      <CellProject key={0}>{projectBadge}</CellProject>,
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

const StyledIdBadge = styled(IdBadge)`
  overflow: hidden;
  white-space: nowrap;
  flex-shrink: 1;
`;
