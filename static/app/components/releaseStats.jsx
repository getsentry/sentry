import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import AvatarList from 'app/components/avatar/avatarList';
import {t} from 'app/locale';

const ReleaseStats = createReactClass({
  displayName: 'ReleaseStats',

  propTypes: {
    release: PropTypes.object,
  },

  render() {
    const release = this.props.release;
    const commitCount = release.commitCount || 0;
    const authorCount = (release.authors && release.authors.length) || 0;
    if (commitCount === 0) {
      return null;
    }

    const releaseSummary =
      commitCount +
      t(commitCount !== 1 ? ' commits ' : ' commit ') +
      t('by ') +
      authorCount +
      t(authorCount !== 1 ? ' authors' : ' author');

    return (
      <div className="release-stats">
        <ReleaseSummaryHeading>{releaseSummary}</ReleaseSummaryHeading>
        <span style={{display: 'inline-block'}}>
          <AvatarList users={release.authors} avatarSize={25} typeMembers={'authors'} />
        </span>
      </div>
    );
  },
});

const ReleaseSummaryHeading = styled.div`
  color: ${p => p.theme.gray2};
  font-size: 12px;
  line-height: 1.2;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 4px;
`;

export default ReleaseStats;
