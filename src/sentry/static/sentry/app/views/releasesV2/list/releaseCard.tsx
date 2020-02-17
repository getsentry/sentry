import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import Count from 'app/components/count';
import LatestDeployOrReleaseTime from 'app/views/releases/list/latestDeployOrReleaseTime';
import Version from 'app/components/version';
import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import ProjectList from 'app/views/releases/list/projectList';
import ReleaseStats from 'app/components/releaseStats';
import {Project, Release} from 'app/types';
import TimeSince from 'app/components/timeSince';
import ReleaseHealth from './releaseHealth';

type Props = {
  release: Release;
  projects: Project[];
  orgId: string;
};

const ReleaseCard = ({release, projects, orgId}: Props) => {
  return (
    <Panel>
      <PanelBody>
        <StyledPanelItem>
          <Layout>
            <Column>
              Release <br />
              <Version
                orgId={orgId}
                version={release.version}
                preserveGlobalSelection
                tooltipRawVersion
              />
            </Column>

            <Column>
              <ProjectList projects={projects} orgId={orgId} version={release.version} />
            </Column>

            <Column>
              <ReleaseStats release={release} />
            </Column>

            <RightAlignedColumn>
              Created <br />
              <LatestDeployOrReleaseTime release={release} />
            </RightAlignedColumn>

            <RightAlignedColumn>
              Last event <br />
              {release.lastEvent ? (
                <TimeSince date={release.lastEvent} />
              ) : (
                <span>—</span>
              )}
            </RightAlignedColumn>

            <RightAlignedColumn>
              New issues <br />
              <Count value={release.newGroups || 0} />
            </RightAlignedColumn>
          </Layout>
        </StyledPanelItem>
      </PanelBody>

      {/*  TODO(releasesv2)if has release health data */}
      {Math.random() > 0.6 && <ReleaseHealth release={release} />}
    </Panel>
  );
};

const StyledPanelItem = styled(PanelItem)`
  /* padding: ${space(1)} ${space(2)}; */
`;

const Layout = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr;
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
`;

const Column = styled('div')`
  overflow: hidden;
`;

const RightAlignedColumn = styled('div')`
  overflow: hidden;
  text-align: right;
`;

const ChartColumn = styled('div')`
  margin-left: ${space(2)};
  margin-right: ${space(2)};
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    display: none;
  }
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

export default ReleaseCard;
