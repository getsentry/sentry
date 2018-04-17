import PropTypes from 'prop-types';
import React from 'react';

import {Box} from '../../components/grid';
import {PanelItem} from '../../components/panels';
import ReleaseStats from '../../components/releaseStats';
import Count from '../../components/count';
import TimeSince from '../../components/timeSince';
import Version from '../../components/version';
import LatestDeployOrReleaseTime from '../../components/latestDeployOrReleaseTime';

class ReleaseList extends React.Component {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    releaseList: PropTypes.array.isRequired,
  };

  render() {
    const {orgId, projectId} = this.props;

    return (
      <div>
        {this.props.releaseList.map(release => {
          return (
            <PanelItem key={release.version} align="center" px={2} py={1}>
              <Box flex="1">
                <div>
                  <div style={{fontWeight: 'bold', marginBottom: 2}}>
                    <Version
                      orgId={orgId}
                      projectId={projectId}
                      version={release.version}
                    />
                  </div>
                  <LatestDeployOrReleaseTime orgId={orgId} release={release} />
                </div>
              </Box>
              <Box w={4 / 12} pl={2} className="hidden-xs">
                <ReleaseStats release={release} />
              </Box>
              <Box w={2 / 12} pl={2}>
                <Count className="release-count" value={release.newGroups} />
              </Box>
              <Box w={2 / 12} pl={2}>
                {release.lastEvent ? (
                  <TimeSince date={release.lastEvent} style={{fontSize: 13}} />
                ) : (
                  <span>—</span>
                )}
              </Box>
            </PanelItem>
          );
        })}
      </div>
    );
  }
}

export default ReleaseList;
