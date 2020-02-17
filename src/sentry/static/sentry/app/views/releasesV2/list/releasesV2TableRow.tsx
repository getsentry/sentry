import React from 'react';

import styled from '@emotion/styled';
import space from 'app/styles/space';
import Count from 'app/components/count';
import {
  Layout,
  Column,
  CenterAlignedColumn,
  RightAlignedColumn,
  ChartColumn,
} from 'app/views/releasesV2/list/commonLayout';
import {PanelItem} from 'app/components/panels';
import UsersChart from 'app/views/releasesV2/list/usersChart';
import {ReleasesV2RowData} from 'app/views/releasesV2/list/types';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import HealthStatus from 'app/views/releasesV2/list/healthStatus';
import LatestDeployOrReleaseTime from 'app/views/releases/list/latestDeployOrReleaseTime';
import Version from 'app/components/version';

type Props = ReleasesV2RowData & {
  organizationId: string;
};

const ReleasesV2TableRow = ({
  release,
  crashFreeUsersPercent,
  graphData,
  activeUsers,
  crashes,
  errors,
  releaseAdoptionPercent,
  organizationId,
}: Props) => {
  return (
    <StyledPanelItem key={release.name}>
      <Layout>
        <Column>
          <HealthStatus crashFreePercent={crashFreeUsersPercent} />
        </Column>

        <Column>
          <StyledVersion
            orgId={organizationId}
            version={release.name}
            preserveGlobalSelection
            tooltipRawVersion
          />
          <LatestDeployOrReleaseTime release={release} />
        </Column>

        <CenterAlignedColumn>
          <CrashFreeUsers percent={crashFreeUsersPercent}>
            {crashFreeUsersPercent}%
          </CrashFreeUsers>
        </CenterAlignedColumn>

        <ChartColumn>
          <UsersChart statsPeriod="24h" data={graphData} />
        </ChartColumn>

        <CenterAlignedColumn>
          <StyledCount value={activeUsers || 0} />
        </CenterAlignedColumn>

        <ChartColumn>
          <UsersChart statsPeriod="24h" data={graphData} />
        </ChartColumn>

        <RightAlignedColumn>
          <Count value={crashes || 0} />
        </RightAlignedColumn>

        <RightAlignedColumn>
          <Count value={errors || 0} />
        </RightAlignedColumn>

        <RightAlignedColumn>{releaseAdoptionPercent}%</RightAlignedColumn>
      </Layout>
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

const CrashFreeUsers = styled('span')<{percent: number}>`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  color: ${p => p.theme.gray4};
  /*  TODO(releasesv2): this color coated demonstration is turned off for now, waiting for decision
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

const StyledCount = styled(Count)`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  color: ${p => p.theme.gray4};
`;

export default ReleasesV2TableRow;
