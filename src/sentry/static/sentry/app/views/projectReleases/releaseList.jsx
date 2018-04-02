import PropTypes from 'prop-types';
import React from 'react';
import {Flex} from 'grid-emotion';

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
            <PanelItem key={release.version} align="center">
              <Flex flex="4">
                <div>
                  <div style={{fontWeight: 'bold', marginBottom: 6}}>
                    <Version
                      orgId={orgId}
                      projectId={projectId}
                      version={release.version}
                    />
                  </div>
                  <LatestDeployOrReleaseTime orgId={orgId} release={release} />
                </div>
              </Flex>
              <Flex flex="4" className="hidden-xs">
                <ReleaseStats release={release} />
              </Flex>
              <Flex flex="2">
                <Count className="release-count" value={release.newGroups} />
              </Flex>
              <Flex flex="2">
                {release.lastEvent ? (
                  <TimeSince date={release.lastEvent} style={{fontSize: 13}} />
                ) : (
                  <span>—</span>
                )}
              </Flex>
            </PanelItem>
          );
        })}
      </div>
    );
  }
}

export default ReleaseList;
