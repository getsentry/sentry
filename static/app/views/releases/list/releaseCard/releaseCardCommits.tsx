import {useMemo} from 'react';
import styled from '@emotion/styled';

import AvatarList from 'sentry/components/avatar/avatarList';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Actor} from 'sentry/types/core';
import type {Release} from 'sentry/types/release';
import type {User} from 'sentry/types/user';
import {uniqueId} from 'sentry/utils/guid';

type Props = {
  release: Release;
  withHeading: boolean;
};

function ReleaseCardCommits({release, withHeading = true}: Props) {
  const commitCount = release.commitCount || 0;
  const authorCount = release.authors?.length || 0;

  const authors = useMemo(
    () =>
      release.authors.map<Actor | User>(author =>
        // Add a unique id if missing
        ({
          ...author,
          type: 'user',
          id: 'id' in author ? author.id : uniqueId(),
        })
      ),
    [release.authors]
  );

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
        <AvatarList users={authors} avatarSize={25} typeAvatars="authors" />
      </span>
    </div>
  );
}

const ReleaseSummaryHeading = styled('div')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1.2;
  font-weight: ${p => p.theme.fontWeightBold};
  text-transform: uppercase;
  margin-bottom: ${space(0.5)};
`;

export default ReleaseCardCommits;
