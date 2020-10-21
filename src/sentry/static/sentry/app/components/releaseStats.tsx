import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import {Release} from 'app/types';
import AvatarList from 'app/components/avatar/avatarList';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';

type Props = {
  release: Release;
  withHeading: boolean;
};

const ReleaseStats = ({release, withHeading = true}: Props) => {
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
      {withHeading && <ReleaseSummaryHeading>{releaseSummary}</ReleaseSummaryHeading>}
      <span style={{display: 'inline-block'}}>
        <AvatarList users={release.authors} avatarSize={25} typeMembers="authors" />
      </span>
    </div>
  );
};

ReleaseStats.propTypes = {
  release: PropTypes.object,
};

const ReleaseSummaryHeading = styled('div')`
  color: ${p => p.theme.gray500};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1.2;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: ${space(0.5)};
`;

export default ReleaseStats;
