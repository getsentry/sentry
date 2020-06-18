import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {IconClock} from 'app/icons';
import RepoLabel from 'app/components/repoLabel';
import TimeSince from 'app/components/timeSince';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';

const LatestDeployOrReleaseTime = ({release}) => {
  const earlierDeploysNum = release.totalDeploys - 1;
  const latestDeploy = release.lastDeploy;
  // if there are deploys associated with the release
  // render the most recent deploy (API will return data ordered by dateFinished)
  // otherwise, render the dateCreated associated with release
  return (
    <div>
      {latestDeploy && latestDeploy.dateFinished ? (
        <div className="deploy">
          <p className="m-b-0 text-light">
            <ReleaseRepoLabel
              style={{
                padding: 3,
                width: 70,
                maxWidth: 86,
                fontSize: 12,
              }}
            >
              {latestDeploy.environment + ' '}
            </ReleaseRepoLabel>{' '}
            <TimeWithIcon date={latestDeploy.dateFinished} />
            {earlierDeploysNum > 0 && (
              <Tooltip title={t('%s earlier deploys', earlierDeploysNum)}>
                <span className="badge">{earlierDeploysNum}</span>
              </Tooltip>
            )}
          </p>
        </div>
      ) : (
        <TimeWithIcon date={release.dateCreated} />
      )}
    </div>
  );
};
LatestDeployOrReleaseTime.propTypes = {
  release: PropTypes.object.isRequired,
};

export default LatestDeployOrReleaseTime;

const ReleaseRepoLabel = styled(RepoLabel)`
  width: 70px;
`;

const TimeWithIcon = styled(({date, ...props}) => (
  <span {...props}>
    <IconClock size="11px" /> <TimeSince date={date} />
  </span>
))`
  display: inline-flex;
  align-items: center;
  color: ${p => p.theme.gray500};
  font-size: ${p => p.theme.fontSizeSmall};
  & > svg {
    margin-right: ${space(0.25)};
  }
`;
