import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import AvatarList from 'app/components/avatar/avatarList';
import {t, tn} from 'app/locale';

class ReleaseStats extends React.Component {
  static propTypes = {
    release: PropTypes.object,
  };

  render() {
    const release = this.props.release;
    const commitCount = release.commitCount || 0;
    const authorCount = (release.authors && release.authors.length) || 0;
    if (commitCount === 0) {
      return null;
    }

    const releaseSummary = [
      tn('%s commit', '%s commits', commitCount),
      t('by'),
      tn('%s author', '%s authors', authorCount),
    ].join(' ');

    return (
      <div className="release-stats">
        <ReleaseSummaryHeading>{releaseSummary}</ReleaseSummaryHeading>
        <span style={{display: 'inline-block'}}>
          <AvatarList users={release.authors} avatarSize={25} typeMembers="authors" />
        </span>
      </div>
    );
  }
}

const ReleaseSummaryHeading = styled('div')`
  color: ${p => p.theme.gray2};
  font-size: 12px;
  line-height: 1.2;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 4px;
`;

export default ReleaseStats;
