import React from 'react';
import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import UserAvatar from 'app/components/avatar/userAvatar';
import Button from 'app/components/button';
import Collapsible from 'app/components/collapsible';
import {t, tn} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Commit, User} from 'app/types';
import {percent} from 'app/utils';
import {userDisplayName} from 'app/utils/formatters';

import {SectionHeading, Wrapper} from './styles';

type GroupedAuthorCommits = {
  [key: string]: {author: User | undefined; commitCount: number};
};

type Props = {
  projectSlug: string;
  orgId: string;
  version: string;
} & AsyncComponent['props'];

type State = {
  commits: Commit[];
} & AsyncComponent['state'];

class CommitAuthorBreakdown extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {orgId, projectSlug, version} = this.props;

    const commitsEndpoint = `/projects/${orgId}/${projectSlug}/releases/${encodeURIComponent(
      version
    )}/commits/`;

    return [['commits', commitsEndpoint]];
  }

  getDisplayPercent(authorCommitCount: number): string {
    const {commits} = this.state;

    const calculatedPercent = Math.round(percent(authorCommitCount, commits.length));

    return `${calculatedPercent < 1 ? '<1' : calculatedPercent}%`;
  }

  renderBody() {
    // group commits by author
    const groupedAuthorCommits = this.state.commits?.reduce(
      (authorCommitsAccumulator, commit) => {
        const email = commit.author?.email ?? 'unknown';

        if (authorCommitsAccumulator.hasOwnProperty(email)) {
          authorCommitsAccumulator[email].commitCount += 1;
        } else {
          authorCommitsAccumulator[email] = {
            commitCount: 1,
            author: commit.author,
          };
        }

        return authorCommitsAccumulator;
      },
      {} as GroupedAuthorCommits
    );

    // sort authors by number of commits
    const sortedAuthorsByNumberOfCommits = Object.values(groupedAuthorCommits).sort(
      (a, b) => b.commitCount - a.commitCount
    );

    if (!sortedAuthorsByNumberOfCommits.length) {
      return null;
    }

    return (
      <Wrapper>
        <SectionHeading>{t('Commit Author Breakdown')}</SectionHeading>
        <Collapsible
          expandButton={({onExpand, numberOfCollapsedItems}) => (
            <Button priority="link" onClick={onExpand}>
              {tn(
                'Show %s collapsed author',
                'Show %s collapsed authors',
                numberOfCollapsedItems
              )}
            </Button>
          )}
        >
          {sortedAuthorsByNumberOfCommits.map(({commitCount, author}, index) => (
            <AuthorLine key={author?.email ?? index}>
              <UserAvatar user={author} size={20} hasTooltip />
              <AuthorName>{userDisplayName(author || {}, false)}</AuthorName>
              <Commits>{tn('%s commit', '%s commits', commitCount)}</Commits>
              <Percent>{this.getDisplayPercent(commitCount)}</Percent>
            </AuthorLine>
          ))}
        </Collapsible>
      </Wrapper>
    );
  }
}

const AuthorLine = styled('div')`
  display: inline-grid;
  grid-template-columns: 30px 2fr 1fr 40px;
  width: 100%;
  margin-bottom: ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const AuthorName = styled('div')`
  color: ${p => p.theme.textColor};
  ${overflowEllipsis};
`;

const Commits = styled('div')`
  color: ${p => p.theme.subText};
  text-align: right;
`;

const Percent = styled('div')`
  min-width: 40px;
  text-align: right;
`;

export default CommitAuthorBreakdown;
