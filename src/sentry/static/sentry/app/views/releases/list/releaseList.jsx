import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import uniq from 'lodash/uniq';
import flatten from 'lodash/flatten';

import {PanelItem} from 'app/components/panels';
import Count from 'app/components/count';
import ReleaseStats from 'app/components/releaseStats';
import TimeSince from 'app/components/timeSince';
import Version from 'app/components/version';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import Projects from 'app/utils/projects';

import {
  LastEventColumn,
  Layout,
  CountColumn,
  VersionColumn,
  ProjectsColumn,
  StatsColumn,
} from './layout';
import LatestDeployOrReleaseTime from './latestDeployOrReleaseTime';
import ProjectList from './projectList';

const ReleaseList = props => {
  const {orgId, releaseList} = props;

  const projectSlugs = uniq(
    flatten(releaseList.map(release => release.projects.map(p => p.slug)))
  );

  return (
    <div>
      <Projects orgId={orgId} slugs={projectSlugs}>
        {({projects}) =>
          releaseList.map(release => (
            <ReleasePanelItem key={release.version}>
              <Layout>
                <VersionColumn>
                  <VersionWrapper>
                    <Version
                      version={release.version}
                      preserveGlobalSelection
                      tooltipRawVersion
                      truncate
                    />
                  </VersionWrapper>
                  <LatestDeployOrReleaseTime orgId={orgId} release={release} />
                </VersionColumn>
                <StatsColumn>
                  <ReleaseStats release={release} />
                </StatsColumn>
                <ProjectsColumn>
                  <ProjectList
                    projects={projects.filter(project =>
                      release.projects.map(p => p.slug).includes(project.slug)
                    )}
                    orgId={orgId}
                    version={release.version}
                  />
                </ProjectsColumn>
                <CountColumn>
                  <Count className="release-count" value={release.newGroups || 0} />
                </CountColumn>
                <LastEventColumn>
                  {release.lastEvent ? (
                    <TimeSince date={release.lastEvent} />
                  ) : (
                    <span>—</span>
                  )}
                </LastEventColumn>
              </Layout>
            </ReleasePanelItem>
          ))
        }
      </Projects>
    </div>
  );
};
ReleaseList.propTypes = {
  orgId: PropTypes.string.isRequired,
  releaseList: PropTypes.array.isRequired,
};

export default ReleaseList;

const ReleasePanelItem = styled(PanelItem)`
  align-items: center;
  padding: ${space(1)} ${space(2)};
`;

const VersionWrapper = styled('div')`
  font-weight: bold;
  margin-bottom: ${space(0.25)};
  ${overflowEllipsis};
  display: inline-block;
  max-width: 100%;
  width: auto;
`;
