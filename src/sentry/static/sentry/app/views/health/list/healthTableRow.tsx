/* eslint-disable react/prop-types */
// TODO: we should probably disable eslint rule react/prop-types for typescript functional components
import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import Count from 'app/components/count';
import {
  StyledLayout,
  StyledColumn,
  StyledCenterAlignedColumn,
  StyledRightAlignedColumn,
  StyledChartColumn,
} from 'app/views/health/list/commonLayout';
import Version from 'app/components/version';
import {PanelItem} from 'app/components/panels';
import UsersChart from 'app/views/health/list/usersChart';
import {HealthRowData} from 'app/views/health/list/types';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import HealthStatus from 'app/views/health/list/healthStatus';
import LatestDeployOrReleaseTime from 'app/views/releases/list/latestDeployOrReleaseTime';

type Props = HealthRowData & {
  organizationId: string;
};

const HealthTableRow: React.FC<Props> = ({
  release,
  crashFreeUsersPercent,
  graphData,
  activeUsers,
  crashes,
  errors,
  releaseAdoptionPercent,
  organizationId,
}) => {
  return (
    <StyledPanelItem key={release.name}>
      <StyledLayout>
        <StyledColumn>
          <HealthStatus crashFreePercent={crashFreeUsersPercent} />
        </StyledColumn>

        <StyledColumn>
          <StyledVersion
            orgId={organizationId}
            version={release.name}
            preserveGlobalSelection
          />
          <LatestDeployOrReleaseTime release={release} />
        </StyledColumn>

        <StyledCenterAlignedColumn>
          <StyledCrashFreeUsers percent={crashFreeUsersPercent}>
            {crashFreeUsersPercent}%
          </StyledCrashFreeUsers>
        </StyledCenterAlignedColumn>

        <StyledChartColumn>
          <UsersChart statsPeriod="24h" data={graphData} />
        </StyledChartColumn>

        <StyledCenterAlignedColumn>
          <StyledActiveUsers value={activeUsers || 0} />
        </StyledCenterAlignedColumn>

        <StyledChartColumn>
          <UsersChart statsPeriod="24h" data={graphData} />
        </StyledChartColumn>

        <StyledRightAlignedColumn>
          <Count value={crashes || 0} />
        </StyledRightAlignedColumn>

        <StyledRightAlignedColumn>
          <Count value={errors || 0} />
        </StyledRightAlignedColumn>

        <StyledRightAlignedColumn>{releaseAdoptionPercent}%</StyledRightAlignedColumn>
      </StyledLayout>
    </StyledPanelItem>
  );
};

const StyledPanelItem = styled(PanelItem)`
  padding: ${space(1)} ${space(2)};
`;

const StyledVersion = styled(Version)`
  font-weight: bold;
  ${overflowEllipsis};
`;

const StyledCrashFreeUsers = styled('span')<{percent: number}>`
  font-size: 20px;
  color: ${p => p.theme.gray4};
  /*  TODO: this color coated demonstration is turned off for now, waiting for decision
  color: ${p => {
    if (p.percent < 33) {
      return p.theme.red;
    }
    if (p.percent < 66) {
      return p.theme.yellowOrange;
    }
    if (p.percent >= 66) {
      return p.theme.green;
    }

    return p.theme.gray3;
  }};
  */
`;

const StyledActiveUsers = styled(Count)`
  font-size: 20px;
  color: ${p => p.theme.gray4};
`;

export default HealthTableRow;
