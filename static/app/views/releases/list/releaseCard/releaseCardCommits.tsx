import {useMemo} from 'react';
import styled from '@emotion/styled';

import AvatarList from 'sentry/components/core/avatar/avatarList';
import {Flex} from 'sentry/components/core/layout';
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
    <Flex className="release-stats" align="center">
      {withHeading && <ReleaseSummaryHeading>{releaseSummary}</ReleaseSummaryHeading>}
      <AvatarList users={authors} avatarSize={25} typeAvatars="authors" />
    </Flex>
  );
}

const ReleaseSummaryHeading = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1.2;
  font-weight: ${p => p.theme.fontWeight.bold};
  text-transform: uppercase;
  margin-bottom: ${space(0.5)};
`;

export default ReleaseCardCommits;
