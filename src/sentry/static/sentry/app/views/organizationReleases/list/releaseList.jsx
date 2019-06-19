import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {PanelItem} from 'app/components/panels';
import Count from 'app/components/count';
import ReleaseStats from 'app/components/releaseStats';
import TimeSince from 'app/components/timeSince';
import Version from 'app/components/version';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

import {LastEventColumn, Layout, CountColumn, VersionColumn, StatsColumn} from './layout';
import LatestDeployOrReleaseTime from './latestDeployOrReleaseTime';

class ReleaseList extends React.Component {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string,
    releaseList: PropTypes.array.isRequired,
  };

  render() {
    const {orgId, projectId} = this.props;

    return (
      <div>
        {this.props.releaseList.map(release => {
          return (
            <ReleasePanelItem key={release.version}>
              <Layout>
                <VersionColumn>
                  <VersionWrapper>
                    <Version
                      orgId={orgId}
                      projectId={projectId}
                      version={release.version}
                      preserveGlobalSelection
                    />
                  </VersionWrapper>
                  <LatestDeployOrReleaseTime orgId={orgId} release={release} />
                </VersionColumn>
                <StatsColumn>
                  <ReleaseStats release={release} />
                </StatsColumn>
                <CountColumn>
                  <Count className="release-count" value={release.newGroups || 0} />
                </CountColumn>
                <LastEventColumn>
                  {release.lastEvent ? (
                    <SmallTimeSince date={release.lastEvent} />
                  ) : (
                    <span>—</span>
                  )}
                </LastEventColumn>
              </Layout>
            </ReleasePanelItem>
          );
        })}
      </div>
    );
  }
}

export default ReleaseList;

const ReleasePanelItem = styled(PanelItem)`
  align-items: center;
  padding: ${space(1)} ${space(2)};
`;

const VersionWrapper = styled('div')`
  font-weight: bold;
  margin-bottom: ${space(0.25)};
  ${overflowEllipsis};
`;

const SmallTimeSince = styled(TimeSince)`
  font-size: ${p => p.theme.fontSizeSmall};
`;
