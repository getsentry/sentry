import React from 'react';
import styled from '@emotion/styled';

import IdBadge from 'app/components/idBadge';
import Link from 'app/components/links/link';
import PanelTable from 'app/components/panels/panelTable';
import {DataCategory, Project} from 'app/types';

import {formatUsageWithUnits} from '../utils';

type Props = {
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
      <CellStat key={1}>{formatUsageWithUnits(total, dataCategory)}</CellStat>,
      <CellStat key={2}>{formatUsageWithUnits(accepted, dataCategory)}</CellStat>,
      <CellStat key={3}>{formatUsageWithUnits(filtered, dataCategory)}</CellStat>,
      <CellStat key={4}>{formatUsageWithUnits(dropped, dataCategory)}</CellStat>,
    ];
  }

  render() {
    const {headers, usageStats} = this.props;

    return (
      <PanelTable headers={headers}>
        {usageStats.map(s => this.renderTableRow(s))}
      </PanelTable>
    );
  }
}

export default UsageTable;

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
